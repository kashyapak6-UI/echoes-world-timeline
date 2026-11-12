import type { Dataset, EventItem } from "./types";
import { EDGE_META } from "./edges";
import { fmtRange } from "./format";

export type Dim = "political" | "social" | "economic";
export type Evidence = "wikidata" | "linked" | "ai";
export type RippleItem = { dim: Dim; text: string; evidence: Evidence; eventId?: string; qid?: string; prop?: string };
export type RippleCountry = { cc: string; name: string; lab: [number, number]; region: string; strength: number; origin: boolean; items: RippleItem[] };
export type Ripple = { origin: [number, number] | null; origins: [number, number][]; countries: RippleCountry[]; windowEnd: number };

export const DIM_LABEL: Record<Dim, string> = { political: "Political / military", social: "Social", economic: "Economic" };
export const EVIDENCE_META: Record<Evidence, { label: string; color: string }> = {
  wikidata: { label: "Recorded in Wikidata", color: "#f5c97a" },
  linked: { label: "Linked event (not causation)", color: "#7cc4ff" },
  ai: { label: "AI-generated — verify", color: "#c084fc" },
};
const POLITICAL = new Set(["partition", "war", "battle", "revolution", "treaty", "assassination", "empire", "dynasty", "religion"]);
export function dimOf(cat: string): Dim {
  if (cat === "financial" || cat === "tech") return "economic";
  if (POLITICAL.has(cat)) return "political";
  return "social"; // pandemic, famine, migration, atrocity, disaster, faith, era
}
const PROP_TEXT: Record<string, string> = { P710: "Recorded participant", P1344: "Recorded as taking part", P17: "Took place in this country", P1542: "Recorded effect" };

/** Build the impact ripple for one event from recorded data only. */
export function computeRipple(data: Dataset, ev: EventItem, ai?: RippleItem[] & { cc?: string }[]): Ripple {
  const map = new Map<string, RippleCountry>();
  const get = (cc: string) => {
    const m = data.countries[cc];
    if (!m) return null;
    if (!map.has(cc)) map.set(cc, { cc, name: m.n, lab: m.lab, region: m.r, strength: 0, origin: false, items: [] });
    return map.get(cc)!;
  };
  const evDim = dimOf(ev.c);
  for (const cc of ev.cc ?? []) {
    const c = get(cc);
    if (c) { c.origin = true; c.strength += 2; c.items.push({ dim: evDim, evidence: "wikidata", text: `Event location recorded in Wikidata (${ev.lsrc ?? "coordinates"}), mapped to present-day ${c.name}` }); }
  }
  // (a) recorded Wikidata links
  for (const r of ev.rp ?? []) {
    const c = get(r.cc); if (!c) continue;
    const linked = data.byId.get(r.q);
    const dim = r.p === "P1542" && linked ? dimOf(linked.c) : r.p === "P710" || r.p === "P1344" ? (POLITICAL.has(ev.c) ? "political" : evDim) : evDim;
    const mapped = c.name !== r.n && r.p !== "P17" ? ` (mapped to present-day ${c.name})` : "";
    c.items.push({ dim, evidence: "wikidata", text: `${PROP_TEXT[r.p]}: ${r.n}${mapped}`, qid: r.q, prop: r.p, eventId: linked?.id });
    c.strength += 2;
  }
  // (b) linked events located elsewhere, starting within a window after the event
  const windowEnd = ev.e + Math.min(50, Math.max(10, (ev.e - ev.s) * 0.5));
  for (const l of data.adj.get(ev.id) ?? []) {
    const o = data.byId.get(l.other);
    if (!o || o.c === "era" || o.s < ev.s - 0.01 || o.s > windowEnd) continue;
    const rel = l.dir === "out" ? EDGE_META[l.edge.k].out : EDGE_META[l.edge.k].in;
    for (const cc of o.cc ?? []) {
      const c = get(cc); if (!c) continue;
      if (c.items.some((x) => x.eventId === o.id && x.evidence === "linked")) continue;
      c.items.push({ dim: dimOf(o.c), evidence: "linked", text: `${rel}: ${o.t} (${fmtRange(o.s, o.e, o.p)})`, eventId: o.id });
      c.strength += 1;
    }
  }
  // (c) optional AI explanation (user's own key), kept separate and labelled
  for (const a of ai ?? []) {
    const cc = (a as RippleItem & { cc?: string }).cc;
    if (!cc) continue;
    const c = get(cc); if (!c) continue;
    c.items.push(a);
    c.strength += 0.5;
  }
  const origins = (ev.ml ?? (ev.ll ? [ev.ll] : [])) as [number, number][];
  const origin = ev.ll ?? null;
  const countries = [...map.values()].filter((c) => c.items.length || c.origin).sort((a, b) => Number(b.origin) - Number(a.origin) || b.strength - a.strength);
  return { origin, origins, countries, windowEnd };
}
