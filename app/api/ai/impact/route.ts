import { currentUser, sameOrigin } from "@/lib/server/auth";
import { dataset, wikiRev } from "@/lib/server/dataset";
import { complete, userLLM } from "@/lib/server/llm";
import { body, json } from "@/lib/server/http";
export const runtime = "nodejs";

// "Explain impact" — uses the signed-in user's server-side stored key. Grounded in the event's Wikipedia summary
// and the recorded ripple links the client computed from Wikidata.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
  const u = currentUser(req); if (!u) return json({ error: "Sign in to use AI features" }, 401);
  const cfg = userLLM(u); if (!cfg) return json({ error: "Connect an AI provider on your profile first" }, 400);
  const b = await body<{ eventId: string; recorded: string[] }>(req);
  const ev = dataset().byId.get(String(b.eventId));
  if (!ev) return json({ error: "Unknown event" }, 404);
  const recorded = (Array.isArray(b.recorded) ? b.recorded : []).slice(0, 40).map((s) => String(s).slice(0, 240));
  const prompt = `Event: ${ev.t} (${ev.d ?? ""}).\nWikipedia summary (CC BY-SA): ${ev.x ?? "n/a"}\nRecorded links by country (from Wikidata and linked events):\n${recorded.join("\n") || "none"}\n\n` +
    `Using ONLY widely documented history consistent with the text above, list up to 8 countries (present-day names) that were affected and HOW, split into social, economic and political/military effects. ` +
    `Say "unknown" rather than guessing. Reply with JSON only: {"summary": string, "countries": [{"country": string, "social": string, "economic": string, "political": string}]}`;
  try {
    const text = await complete(cfg, [{ role: "system", content: "You are a careful historian. Be concise, neutral and factual." }, { role: "user", content: prompt }], 900);
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return json({
      summary: String(parsed.summary ?? ""), countries: Array.isArray(parsed.countries) ? parsed.countries.slice(0, 12) : [], model: `${cfg.provider} · ${cfg.model}`,
      sources: [
        ...(ev.w ? [{ label: `Wikipedia: ${ev.w}${ev.xr ? ` (rev ${ev.xr})` : ""}`, url: wikiRev(ev) }] : []),
        { label: `Wikidata: ${ev.id}`, url: `https://www.wikidata.org/wiki/${ev.id}` },
      ],
    });
  } catch (e) { return json({ error: (e as Error).message.startsWith("Provider") ? (e as Error).message : "The model did not return usable JSON" }, 502); }
}
