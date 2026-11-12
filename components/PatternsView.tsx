"use client";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { Dataset, Pattern } from "@/lib/types";
import { useStore } from "@/lib/store";
import { fmtCentury, fmtSpan, fmtYear } from "@/lib/format";
import { focusEvent } from "@/lib/focus";
import { wikiRevUrl, wdUrl } from "@/lib/format";

const C0 = -35, C1 = 20; // centuries shown in the heatmap: 3500 BCE .. 2000s

export function PatternsView({ data }: { data: Dataset }) {
  const pats = data.patterns.patterns;
  const [hover, setHover] = useState<{ p: Pattern; c: number; n: number } | null>(null);
  const soloCat = useStore((s) => s.soloCat);
  const soloRel = useStore((s) => s.soloRel);
  const allRels = data.religions.religions.map((r) => r.id);
  const openRel = (id: string, c: number) => { soloCat("faith", all); useStore.setState((st) => ({ hiddenCats: new Set([...st.hiddenCats].filter((x) => x !== "religion")) })); soloRel(id, allRels); setRange([c * 100 - 10, c * 100 + 110]); setView("timeline"); };
  const setView = useStore((s) => s.setView);
  const setRange = useStore((s) => s.setRange);
  const all = data.meta.categories.map((c) => c.id);
  const cols = useMemo(() => Array.from({ length: C1 - C0 + 1 }, (_, i) => C0 + i), []);
  const conc = data.patterns.concurrency;
  const concMax = Math.max(...cols.map((c) => conc[c] ?? 0), 1);

  const openCell = (p: Pattern, c: number) => {
    soloCat(p.id, all);
    setRange([c * 100 - 10, c * 100 + 110]);
    setView("timeline");
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto px-6 pb-16 pt-6 md:px-10">
      <div className="max-w-3xl">
        <p className="text-[11px] uppercase tracking-[.2em] text-gold">Patterns</p>
        <h1 className="mt-1 font-display text-5xl leading-none">History doesn’t repeat — but it rhymes.</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          Each row is a recurring type of event, grouped by its Wikidata class. Cells count how many events of that type started in each century
          (for empires and dynasties we count the <em>fall</em>). Gaps are the time between consecutive events of the same type. These are descriptive counts of what
          Wikipedia/Wikidata record — recent centuries and Europe are documented far more densely, so treat ancient sparsity as missing records, not calm.
        </p>
      </div>

      {/* heatmap */}
      <div className="relative mt-8 overflow-x-auto rounded-2xl border border-line bg-panel/60 p-4">
        <div className="min-w-[920px]">
          <div className="mb-1 flex items-end">
            <div className="w-48 shrink-0 text-[10px] uppercase tracking-wider text-muted">All events active</div>
            <div className="flex h-10 flex-1 items-end gap-px">
              {cols.map((c) => <div key={c} className="flex-1 rounded-t-sm bg-glow/50" style={{ height: `${Math.max(2, ((conc[c] ?? 0) / concMax) * 100)}%` }} title={`${fmtCentury(c)}: ${conc[c] ?? 0}`} />)}
            </div>
          </div>
          {pats.map((p, ri) => {
            const max = Math.max(...Object.values(p.byCentury));
            return (
              <motion.div key={p.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: ri * 0.03 }} className="flex items-center">
                <div className="flex w-48 shrink-0 items-center gap-2 py-0.5 text-[12px]"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} /><span className="truncate">{p.label}</span></div>
                <div className="flex h-5 flex-1 gap-px">
                  {cols.map((c) => {
                    const n = p.byCentury[c] ?? 0;
                    const a = n ? 0.15 + 0.85 * Math.sqrt(n / max) : 0;
                    return (
                      <button key={c} onMouseEnter={() => setHover({ p, c, n })} onMouseLeave={() => setHover(null)} onClick={() => n && openCell(p, c)}
                        className="flex-1 rounded-[2px] transition hover:outline hover:outline-1 hover:outline-white" style={{ background: n ? p.color : "rgba(255,255,255,0.03)", opacity: n ? a : 1 }}
                        aria-label={`${p.label}, ${fmtCentury(c)}: ${n}`} />
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
          <div className="mb-1 mt-4 text-[10px] uppercase tracking-[.16em] text-muted">Religions — origins, figures, texts, sites and events per century (Wikidata dates)</div>
          {data.patterns.religions.filter((r) => r.n > 0).map((r) => {
            const max = Math.max(...Object.values(r.byCentury), 1);
            return (
              <div key={r.id} className="flex items-center">
                <div className="flex w-48 shrink-0 items-center gap-2 py-0.5 text-[12px]"><span className="h-2 w-2 rounded-full" style={{ background: r.color }} /><span className="truncate">{r.label}</span><span className="font-mono text-[10px] text-muted">{r.n}</span></div>
                <div className="flex h-4 flex-1 gap-px">
                  {cols.map((c) => {
                    const n = r.byCentury[c] ?? 0;
                    return <button key={c} onClick={() => n && openRel(r.id, c)} title={`${r.label}, ${fmtCentury(c)}: ${n}`} aria-label={`${r.label}, ${fmtCentury(c)}: ${n}`}
                      className="flex-1 rounded-[2px] hover:outline hover:outline-1 hover:outline-white" style={{ background: n ? r.color : "rgba(255,255,255,0.03)", opacity: n ? 0.2 + 0.8 * Math.sqrt(n / max) : 1 }} />;
                  })}
                </div>
              </div>
            );
          })}
          <div className="mt-1 flex">
            <div className="w-48 shrink-0" />
            <div className="flex flex-1 justify-between font-mono text-[10px] text-muted">
              {[-35, -25, -15, -5, 5, 10, 15, 20].map((c) => <span key={c}>{fmtYear(c < 0 ? c * 100 + 1 : c * 100)}</span>)}
            </div>
          </div>
        </div>
        <div className="mt-2 h-5 text-[12px] text-muted">
          {hover ? <span><span style={{ color: hover.p.color }}>{hover.p.label}</span> · {fmtCentury(hover.c)} · <span className="text-white">{hover.n}</span> events{hover.n ? " — click to open on the timeline" : ""}</span> : "Hover a cell; click to open that century on the timeline."}
        </div>
      </div>

      {/* pattern cards */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {pats.map((p, i) => (
          <motion.article key={p.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ delay: (i % 2) * 0.06 }}
            className="rounded-2xl border border-line bg-panel/60 p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-3xl leading-none" style={{ color: p.color }}>{p.label}</h3>
              <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-muted">{p.n} events</span>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-[12px]">
              <Stat k="Median gap" v={fmtSpan(p.medianGap)} sub={`IQR ${fmtSpan(p.p25Gap)}–${fmtSpan(p.p75Gap)}`} />
              <Stat k="Median gap since 1526" v={fmtSpan(p.medianGapLast500)} sub={`${p.nLast500} events`} />
              <Stat k="Busiest centuries" v={p.busiest.map((b) => fmtCentury(b.century).replace(" c.", "c")).slice(0, 2).join(", ")} sub={p.busiest.map((b) => b.n).slice(0, 2).join(" / ") + " events"} />
            </dl>
            <div className="mt-5 text-[10px] uppercase tracking-[.16em] text-muted">Echoes — best-known {p.label.toLowerCase()} in time order ({p.measure})</div>
            <ol className="mt-2 flex flex-wrap items-center gap-y-2 text-[12px]">
              {p.echoes.map((e, j) => {
                const ev = data.byId.get(e.id);
                if (!ev) return null;
                return (
                  <li key={e.id} className="flex items-center">
                    {j > 0 && <span className="mx-1.5 font-mono text-[10px] text-muted">+{fmtSpan(e.gap)} →</span>}
                    <button onClick={() => { focusEvent(data, e.id); setView("timeline"); }} className="rounded-full border px-2.5 py-1 text-left transition hover:bg-white/5" style={{ borderColor: p.color + "55" }}>
                      {ev.t} <span className="font-mono text-[10px] text-muted">{fmtYear(e.at)}</span>
                    </button>
                    <a href={ev.w ? wikiRevUrl(ev.w, ev.xr) : wdUrl(ev.id)} target="_blank" rel="noopener noreferrer" title={ev.w ? `Source: Wikipedia “${ev.w}”` : `Source: Wikidata ${ev.id}`} className="ml-0.5 text-[10px] text-muted hover:text-gold">↗</a>
                  </li>
                );
              })}
            </ol>
          </motion.article>
        ))}
      </div>
    </div>
  );
}
function Stat({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="rounded-xl bg-white/[.03] p-3">
      <dt className="text-[10px] uppercase tracking-wider text-muted">{k}</dt>
      <dd className="mt-1 text-[15px] text-white">{v}</dd>
      <dd className="text-[10px] text-muted">{sub}</dd>
    </div>
  );
}
