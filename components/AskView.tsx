"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import type { Citation } from "@/lib/citations";
import { useMe } from "@/lib/useMe";
import { isStaticExport } from "@/lib/config";
import { StaticUnavailablePage } from "./StaticUnavailable";

type Turn = { q: string; a: string; sources: Citation[]; notes: string[]; model?: string; error?: string; done: boolean };
const KIND: Record<Citation["kind"], { label: string; color: string }> = {
  event: { label: "Dataset event", color: "#f5c97a" }, news: { label: "Live news", color: "#7cf5c4" }, onthisday: { label: "On this day", color: "#7cc4ff" },
};
const SUGGEST = ["What led to the partition of India and what followed?", "How did the 1918 flu pandemic spread after World War I?", "Which financial crises look like the 2008 crisis?", "What happened on this day in history?"];

export function AskView() {
  const { user, loaded } = useMe();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setBusy(true); setQ("");
    const history = turns.flatMap((t) => [{ role: "user", content: t.q }, { role: "assistant", content: t.a }]);
    setTurns((ts) => [...ts, { q: question, a: "", sources: [], notes: [], done: false }]);
    const upd = (f: (t: Turn) => Turn) => setTurns((ts) => ts.map((t, i) => (i === ts.length - 1 ? f(t) : t)));
    try {
      const res = await fetch("/api/ai/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, history }) });
      if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); upd((t) => ({ ...t, error: j.error ?? `HTTP ${res.status}`, done: true })); return; }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (!line.trim()) continue;
          const m = JSON.parse(line);
          if (m.t === "sources") upd((t) => ({ ...t, sources: m.sources, notes: m.notes, model: m.model }));
          else if (m.t === "delta") upd((t) => ({ ...t, a: t.a + m.v }));
          else if (m.t === "error") upd((t) => ({ ...t, error: m.error }));
        }
      }
      upd((t) => ({ ...t, done: true }));
    } catch (e) { upd((t) => ({ ...t, error: String(e), done: true })); }
    finally { setBusy(false); }
  };

  const gate = loaded && (!user ? "login" : !user.key ? "key" : null);
  if (isStaticExport) return <StaticUnavailablePage feature="Ask Echoes" />;
  return (
    <main className="grain flex h-dvh flex-col bg-ink">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line px-5">
        <Link href="/" className="font-display text-2xl italic text-gold">Echoes</Link>
        <Link href="/explore" className="text-sm text-muted hover:text-white">Explore</Link>
        <span className="flex items-center gap-1.5 text-sm text-[#e9d5ff]"><Sparkles size={14} /> Ask Echoes</span>
        <div className="flex-1" />
        {user && <Link href="/profile" className="text-sm text-muted hover:text-white">{user.key ? `${user.key.provider} · ${user.key.model}` : "Connect AI"}</Link>}
      </header>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 py-8">
          {turns.length === 0 && (
            <div>
              <h1 className="font-display text-5xl leading-none">Ask the record.</h1>
              <p className="mt-3 max-w-xl text-[14px] text-muted">Answers are written by your own AI provider, but only from sources Echoes retrieves for you: events in the dataset (Wikipedia + Wikidata) and live news from GDELT. Every claim is cited — click a number to open its source. AI-generated text — verify.</p>
              {gate === "login" && <p className="mt-5 text-[14px]"><Link className="text-gold underline" href="/login?next=/ask">Sign in</Link> or <Link className="text-gold underline" href="/signup?next=/ask">create a profile</Link> to ask questions.</p>}
              {gate === "key" && <p className="mt-5 text-[14px]">Connect an AI provider on your <Link className="text-gold underline" href="/profile">profile</Link> first.</p>}
              {!gate && <div className="mt-6 flex flex-wrap gap-2">{SUGGEST.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border border-line px-3 py-1.5 text-[13px] text-muted hover:border-gold/50 hover:text-white">{s}</button>)}</div>}
            </div>
          )}
          {turns.map((t, i) => (
            <article key={i} className="mb-10">
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-white/[.06] px-4 py-2.5 text-[14px]">{t.q}</div>
              <div className="mt-4 rounded-2xl border border-line bg-panel/60 p-5">
                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[.16em] text-[#c084fc]"><span>AI-generated — verify</span><span className="normal-case tracking-normal text-muted">{t.model}</span></div>
                {!t.a && !t.error && <div className="flex items-center gap-2 text-[13px] text-muted"><span className="h-2 w-2 animate-ping rounded-full bg-[#c084fc]" />{t.sources.length ? `Reading ${t.sources.length} sources…` : "Finding sources…"}</div>}
                <Answer text={t.a} sources={t.sources} />
                {t.error && <p className="mt-2 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-[12px] text-red-200">{t.error}</p>}
                {t.sources.length > 0 && (
                  <div className="mt-4 border-t border-line pt-3">
                    <div className="text-[10px] uppercase tracking-[.16em] text-muted">Sources</div>
                    <ol className="mt-2 space-y-1.5">
                      {t.sources.map((s) => (
                        <li key={s.n} id={`src-${i}-${s.n}`} className="flex gap-2 text-[12px]">
                          <span className="w-6 shrink-0 font-mono text-gold">[{s.n}]</span>
                          <span className="min-w-0">
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-white hover:text-gold hover:underline">{s.title}</a>
                            <span className="ml-2 text-[10px]" style={{ color: KIND[s.kind].color }}>{KIND[s.kind].label}</span>
                            <span className="block font-mono text-[10px] text-muted">{[s.outlet, s.date].filter(Boolean).join(" · ")}
                              {s.wikidata && <> · <a href={s.wikidata} target="_blank" rel="noopener noreferrer" className="underline">Wikidata</a></>}
                              {s.eventId && <> · <Link href={`/explore?event=${s.eventId}`} className="underline">open in Echoes</Link></>}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                    {t.notes.length > 0 && <p className="mt-2 text-[10px] text-muted">{t.notes.join(" · ")}</p>}
                  </div>
                )}
              </div>
            </article>
          ))}
          <div ref={end} />
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="shrink-0 border-t border-line bg-ink/90 px-5 py-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-line bg-panel px-3 py-2 focus-within:border-gold/50">
          <textarea value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }}
            rows={1} disabled={!!gate} placeholder={gate ? "Sign in and connect an AI provider to ask" : "Ask about any event, period or pattern…"} aria-label="Question"
            className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-[14px] outline-none disabled:opacity-50" />
          <button disabled={busy || !q.trim() || !!gate} className="grid h-9 w-9 place-items-center rounded-full bg-gold text-ink disabled:opacity-40" aria-label="Send"><ArrowUp size={16} /></button>
        </div>
      </form>
    </main>
  );
}

/** Renders the answer, turning [n] markers into clickable citation links to the source URL. */
function Answer({ text, sources }: { text: string; sources: Citation[] }) {
  if (!text) return null;
  const byN = new Map(sources.map((s) => [s.n, s]));
  const parts = text.split(/(\[\d+\])/g);
  return (
    <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#e3e6f0]">
      {parts.map((p, i) => {
        const m = p.match(/^\[(\d+)\]$/);
        const s = m && byN.get(+m[1]);
        if (!s) return <span key={i}>{p}</span>;
        return <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" title={`${s.title}${s.outlet ? ` — ${s.outlet}` : ""}`}
          className="mx-0.5 inline-grid h-[18px] min-w-[18px] place-items-center rounded px-1 align-[2px] font-mono text-[10px] text-ink hover:brightness-110" style={{ background: KIND[s.kind].color }}>{s.n}</a>;
      })}
    </div>
  );
}
