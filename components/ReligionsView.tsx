"use client";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { BookOpen } from "lucide-react";
import type { Dataset, EventItem } from "@/lib/types";
import { useStore } from "@/lib/store";
import { fmtRange, fmtYear, wdUrl } from "@/lib/format";
import { toU } from "@/lib/scale";
import { SourceLinks } from "./SourceLinks";

const Y0 = -3499, Y1 = 2026;
const KINDS = [
  { id: "origin", label: "Origin", shape: "◆" },
  { id: "founder", label: "Founder", shape: "★" },
  { id: "figure", label: "Figure", shape: "●" },
  { id: "scripture", label: "Text", shape: "■" },
  { id: "site", label: "Site", shape: "▲" },
  { id: "event", label: "Event", shape: "◇" },
] as const;
const circa = (e: EventItem) => { const r = fmtRange(e.s, e.e, e.p); return e.ap && !r.startsWith("c.") ? `c. ${r}` : r; };
const AXIS = [-3000, -2000, -1000, -500, 1, 500, 1000, 1500, 1800, 1900, 2000];

export function ReligionsView({ data }: { data: Dataset }) {
  const select = useStore((s) => s.select);
  const hiddenRels = useStore((s) => s.hiddenRels);
  const [kinds, setKinds] = useState<Set<string>>(new Set(KINDS.map((k) => k.id)));
  const [hover, setHover] = useState<EventItem | null>(null);
  const rels = data.religions.religions.filter((r) => !hiddenRels.has(r.id));
  const byRel = useMemo(() => {
    const m = new Map<string, EventItem[]>();
    for (const e of data.events) if (e.rel) { if (!m.has(e.rel)) m.set(e.rel, []); m.get(e.rel)!.push(e); }
    return m;
  }, [data]);
  const u0 = toU(Y0, "deep"), u1 = toU(Y1, "deep");
  const pct = (y: number) => ((toU(Math.max(Y0, Math.min(Y1, y)), "deep") - u0) / (u1 - u0)) * 100;
  const kindOf = (e: EventItem) => e.rk ?? "event";

  return (
    <div className="scroll-thin h-full overflow-y-auto px-6 pb-16 pt-6 md:px-10">
      <div className="max-w-3xl">
        <p className="text-[11px] uppercase tracking-[.2em] text-gold">Religions</p>
        <h1 className="mt-1 font-display text-5xl leading-none">Where the world’s faiths begin — as the records date them.</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          Origins, founders, key figures, scriptures, places of worship and events for twelve major religions. Every date is the value recorded in Wikidata (CC0);
          summaries come from Wikipedia (CC BY-SA). We never date anything from scripture ourselves. Where Wikidata holds several values (often a traditional and a scholarly one)
          all of them are listed; “c.” marks dates recorded as circa, uncertain or with decade/century precision. Some origins have no inception date in Wikidata at all and are listed as such.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-[12px]">
        {KINDS.map((k) => {
          const on = kinds.has(k.id);
          return <button key={k.id} onClick={() => setKinds((s) => { const n = new Set(s); if (on) n.delete(k.id); else n.add(k.id); return n; })}
            className={`rounded-full border px-3 py-1 ${on ? "border-gold/50 text-white" : "border-line text-muted line-through"}`}>{k.shape} {k.label}</button>;
        })}
      </div>

      {/* deep-time rows */}
      <div className="relative mt-4 overflow-x-auto rounded-2xl border border-line bg-panel/60 p-4">
        <div className="relative min-w-[900px]">
          <div className="relative ml-40 h-5 font-mono text-[10px] text-muted">
            {AXIS.map((y) => <span key={y} className="absolute -translate-x-1/2" style={{ left: `${pct(y)}%` }}>{fmtYear(y <= 0 ? y : y)}</span>)}
          </div>
          {rels.map((r) => {
            const evs = (byRel.get(r.id) ?? []).filter((e) => kinds.has(kindOf(e)));
            return (
              <div key={r.id} className="flex items-center border-t border-white/5">
                <div className="flex w-40 shrink-0 items-center gap-2 py-2 text-[13px]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />{r.label}<span className="font-mono text-[10px] text-muted">{evs.length}</span></div>
                <div className="relative h-9 flex-1">
                  {AXIS.map((y) => <span key={y} className="absolute inset-y-0 w-px bg-white/5" style={{ left: `${pct(y)}%` }} />)}
                  {evs.filter((e) => e.e - e.s > 30 && kindOf(e) !== "figure").map((e) => (
                    <span key={e.id + "b"} className="absolute top-1/2 h-1 -translate-y-1/2 rounded" style={{ left: `${pct(e.s)}%`, width: `${Math.max(0.3, pct(e.e) - pct(e.s))}%`, background: r.color, opacity: 0.25 }} />
                  ))}
                  {evs.map((e) => {
                    const k = KINDS.find((x) => x.id === kindOf(e))!;
                    return (
                      <button key={e.id} onMouseEnter={() => setHover(e)} onMouseLeave={() => setHover(null)} onClick={() => select(e.id)}
                        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] leading-none transition hover:scale-150"
                        style={{ left: `${pct(e.s)}%`, color: r.color, opacity: e.ap ? 0.6 : 1, fontSize: k.id === "origin" || k.id === "founder" ? 15 : 10 }} aria-label={`${e.t}, ${fmtRange(e.s, e.e, e.p)}`}>
                        {k.shape}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 h-5 text-[12px] text-muted">
          {hover ? <span><span className="text-white">{hover.t}</span> · <span className="font-mono">{circa(hover)}</span>{hover.d ? ` · ${hover.d}` : ""}</span> : "Faded marks = circa / uncertain dates. Hover a mark; click to open its details and sources."}
        </div>
      </div>

      {/* religion cards */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {rels.map((r, i) => {
          const evs = byRel.get(r.id) ?? [];
          const origins = evs.filter((e) => e.rk === "origin");
          const founders = evs.filter((e) => e.rk === "founder");
          const undated = data.religions.undated.filter((u) => u.rel === r.id);
          const st = data.religions.stats[r.id] ?? {};
          const figs = evs.filter((e) => e.rk === "figure" || e.rk === "founder").sort((a, b) => b.sl - a.sl).slice(0, 5);
          const texts = data.religions.texts[r.id] ?? [];
          return (
            <motion.article key={r.id} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ delay: (i % 3) * 0.05 }}
              className="rounded-2xl border border-line bg-panel/60 p-5" style={{ borderTopColor: r.color, borderTopWidth: 3 }}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-3xl leading-none" style={{ color: r.color }}>{r.label}</h3>
                <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-muted">{evs.length} items</span>
              </div>
              <div className="mt-3 text-[10px] uppercase tracking-[.16em] text-muted">Origin (Wikidata inception)</div>
              {origins.map((o) => (
                <div key={o.id} className="mt-1 text-[13px]">
                  <button onClick={() => select(o.id)} className="text-left hover:text-gold">{o.t}</button>: <span className="font-mono text-gold">{circa(o)}</span>
                  {o.of?.at && <span className="text-muted"> · formed in {o.of.at}</span>}
                  {o.of?.by?.length ? <div className="text-[12px] text-muted">Founder(s) recorded: <span className="text-white">{o.of.by.join(", ")}</span></div> : null}
                  {o.dn && <ul className="mt-1 text-[11px] text-[#e9d9b5]">{o.dn.map((n) => <li key={n}>• {n}</li>)}</ul>}
                  <SourceLinks ev={o} className="mt-1" />
                </div>
              ))}
              {undated.map((u) => (
                <div key={u.id} className="mt-1 text-[13px] text-muted">
                  {u.label}: <span className="italic">no inception date recorded in Wikidata</span> <a href={wdUrl(u.id)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#7cc4ff]">Wikidata ↗</a>
                </div>
              ))}
              {(founders.length > 0 || figs.length > 0) && (
                <>
                  <div className="mt-3 text-[10px] uppercase tracking-[.16em] text-muted">Key figures</div>
                  <ul className="mt-1 space-y-0.5 text-[12px]">
                    {[...new Map([...founders, ...figs].map((e) => [e.id, e])).values()].slice(0, 6).map((e) => (
                      <li key={e.id} className="flex flex-wrap items-baseline gap-x-2"><button onClick={() => select(e.id)} className="hover:text-gold">{e.rk === "founder" ? "★ " : ""}{e.t}</button><span className="font-mono text-[10px] text-muted">{circa(e)}</span></li>
                    ))}
                  </ul>
                </>
              )}
              <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[10px] text-muted">
                {(["figure", "scripture", "site", "event", "tagged"] as const).map((k) => <div key={k} className="rounded bg-white/[.03] py-1"><div className="text-[13px] text-white">{st[k] ?? 0}</div>{k === "tagged" ? "history" : k}</div>)}
              </div>
              {texts.length > 0 && (
                <>
                  <div className="mt-3 text-[10px] uppercase tracking-[.16em] text-muted">Read the texts (public domain / open)</div>
                  <ul className="mt-1 space-y-1 text-[12px]">
                    {texts.map((t) => (
                      <li key={t.url}><a href={t.url} target="_blank" rel="noopener noreferrer" className="flex gap-1.5 hover:text-gold"><BookOpen size={12} className="mt-0.5 shrink-0" style={{ color: r.color }} /><span>{t.title} <span className="text-[10px] text-muted">· {t.host} · {t.licence}</span></span></a></li>
                    ))}
                  </ul>
                </>
              )}
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}
