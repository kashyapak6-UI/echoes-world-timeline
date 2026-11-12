import { currentUser, sameOrigin } from "@/lib/server/auth";
import { searchEvents, terms, wikiRev } from "@/lib/server/dataset";
import { gdeltNews, onThisDay } from "@/lib/server/live";
import { streamText, userLLM, type Msg } from "@/lib/server/llm";
import { body, json } from "@/lib/server/http";
import type { Citation } from "@/lib/citations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fmtY = (y: number) => { const yr = Math.floor(y + 1e-6); return yr <= 0 ? `${1 - yr} BCE` : `${yr}`; };
const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
  const u = currentUser(req); if (!u) return json({ error: "Sign in to use Ask Echoes" }, 401);
  const cfg = userLLM(u); if (!cfg) return json({ error: "Connect an AI provider on your profile first" }, 400);
  const b = await body<{ question: string; history: { role: string; content: string }[]; live: boolean }>(req);
  const question = String(b.question ?? "").trim().slice(0, 1000);
  if (!question) return json({ error: "Ask a question" }, 400);

  // --- retrieval: dataset events + live sources ---
  const sources: Citation[] = [];
  for (const e of searchEvents(question, 8)) {
    sources.push({ n: sources.length + 1, kind: "event", title: e.t, url: wikiRev(e), wikidata: `https://www.wikidata.org/wiki/${e.id}`, eventId: e.id, outlet: e.w ? "Wikipedia" : "Wikidata",
      date: e.s === e.e ? fmtY(e.s) : `${fmtY(e.s)}–${fmtY(e.e)}`, text: `${e.d ?? ""}. ${e.x ?? ""}`.slice(0, 700) });
  }
  const notes: string[] = [];
  if (b.live !== false) {
    // GDELT ANDs space-separated terms: use the 3 longest (most specific) terms
    const t = terms(question).filter((w) => !/^\d+$/.test(w)).sort((a, b) => b.length - a.length).slice(0, 3);
    if (t.length) {
      const news = await within(gdeltNews(`${t.join(" ")} sourcelang:english`, "1w", 8), 18000);
      if (!news) notes.push("Live news (GDELT) timed out");
      else if (news.error) notes.push(`Live news: ${news.error}`);
      for (const a of (news?.items ?? []).slice(0, 6)) sources.push({ n: sources.length + 1, kind: "news", title: a.title, url: a.url, outlet: a.outlet, date: a.date?.slice(0, 10), text: `News headline (${a.outlet}, ${a.date?.slice(0, 10)}): ${a.title}`, provider: "GDELT" });
    }
    if (/\b(today|on this day|this date)\b/i.test(question)) {
      const d = new Date();
      const otd = await within(onThisDay(d.getMonth() + 1, d.getDate()), 8000);
      for (const x of (otd?.items ?? []).slice(0, 6)) sources.push({ n: sources.length + 1, kind: "onthisday", title: `${x.year}: ${x.text}`.slice(0, 160), url: x.pages[0]?.url ?? "https://en.wikipedia.org/wiki/Wikipedia:Selected_anniversaries", outlet: "Wikipedia — On this day", date: String(x.year), text: `${x.year}: ${x.text}`, provider: "Wikipedia" });
    }
  }
  const ctx = sources.map((s) => `[${s.n}] (${s.kind}${s.date ? `, ${s.date}` : ""}${s.outlet ? `, ${s.outlet}` : ""}) ${s.title}\n${s.text}`).join("\n\n");
  const messages: Msg[] = [
    { role: "system", content: "You are Echoes, a careful, neutral world-history guide. Answer ONLY from the numbered sources provided. Cite every factual sentence with the source number in square brackets, e.g. [2] or [1][4]. If the sources do not cover something, say so plainly instead of guessing. News headlines are recent reports, not verified history. Keep answers under 250 words." },
    ...((b.history ?? []).slice(-6).filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 2000) }))),
    { role: "user", content: `Sources:\n\n${ctx || "(no matching sources found)"}\n\nQuestion: ${question}` },
  ];

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(c) {
      const send = (o: unknown) => c.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      send({ t: "sources", sources: sources.map(({ text: _t, ...s }) => { void _t; return s; }), notes, model: `${cfg.provider} · ${cfg.model}` });
      try { for await (const d of streamText(cfg, messages)) send({ t: "delta", v: d }); send({ t: "done" }); }
      catch (e) { send({ t: "error", error: (e as Error).message }); }
      c.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
