import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { EventItem } from "@/lib/types";

let events: EventItem[] | null = null;
let byId: Map<string, EventItem> | null = null;
export function dataset() {
  if (!events) {
    events = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/data/events.json"), "utf8")) as EventItem[];
    byId = new Map(events.map((e) => [e.id, e]));
  }
  return { events, byId: byId! };
}
const STOP = new Set("led lead leads followed follow happened happen cause caused causes result results effect effects impact tell explain look looks like similar history historical event events the a an of in on at to for and or is was were what which who whom how why when where did does do with from by about between after before during that this these those it its as be been are than then there their into over under".split(" "));
export const terms = (q: string) => [...new Set(q.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];

/** Simple keyword retrieval over titles, descriptions and Wikipedia summaries, boosted by notability. */
export function searchEvents(q: string, k = 8): EventItem[] {
  const t = terms(q);
  if (!t.length) return [];
  const years = [...q.matchAll(/\b(\d{3,4})\b/g)].map((m) => +m[1]);
  const scored: [number, EventItem][] = [];
  for (const e of dataset().events) {
    const title = e.t.toLowerCase(), body = `${e.d ?? ""} ${e.x ?? ""}`.toLowerCase();
    let s = 0, th = 0;
    for (const w of t) {
      const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
      if (re.test(title)) { s += 3; th++; } else if (re.test(body)) s += 1;
    }
    if (!s) continue;
    s += th * th * 2; // events whose title matches several query terms come first
    if (years.some((y) => y >= e.s - 1 && y <= e.e + 1)) s += 2;
    s += Math.log10(1 + e.sl) * 0.6;
    scored.push([s, e]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, k).map((x) => x[1]);
}
export const wikiRev = (e: EventItem) => e.w ? `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(e.w.replace(/ /g, "_"))}${e.xr ? `&oldid=${e.xr}` : ""}` : `https://www.wikidata.org/wiki/${e.id}`;
