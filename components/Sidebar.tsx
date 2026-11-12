"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, SlidersHorizontal } from "lucide-react";
import type { Dataset } from "@/lib/types";
import { useStore } from "@/lib/store";
import { isStaticExport } from "@/lib/config";

export function Sidebar({ data }: { data: Dataset }) {
  const [open, setOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 900);
  const hiddenCats = useStore((s) => s.hiddenCats);
  const toggleCat = useStore((s) => s.toggleCat);
  const soloCat = useStore((s) => s.soloCat);
  const hiddenRegions = useStore((s) => s.hiddenRegions);
  const toggleRegion = useStore((s) => s.toggleRegion);
  const minFame = useStore((s) => s.minFame);
  const setMinFame = useStore((s) => s.setMinFame);
  const scale = useStore((s) => s.scale);
  const setScale = useStore((s) => s.setScale);
  const all = data.meta.categories.map((c) => c.id);
  const hiddenRels = useStore((s) => s.hiddenRels);
  const toggleRel = useStore((s) => s.toggleRel);
  const soloRel = useStore((s) => s.soloRel);
  const allRels = data.religions.religions.map((r) => r.id);
  const relCount = (id: string) => data.events.filter((e) => e.rel === id).length;
  const ripple = useStore((s) => s.ripple);
  const setRipple = useStore((s) => s.setRipple);
  const regionCount = (id: string) => data.events.filter((e) => e.r === id).length;

  return (
    <motion.aside animate={{ width: open ? 264 : 44 }} transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="relative z-20 shrink-0 overflow-hidden border-r border-line bg-panel/60">
      <button onClick={() => setOpen(!open)} aria-label={open ? "Collapse filters" : "Expand filters"}
        className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-white/5 hover:text-white">
        {open ? <ChevronLeft size={16} /> : <SlidersHorizontal size={16} />}
      </button>
      <div className={`scroll-thin h-full w-[264px] overflow-y-auto p-4 pt-3 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <h3 className="mb-2 text-[11px] uppercase tracking-[.18em] text-muted">Event types</h3>
        <div className="mb-2 flex gap-2 text-[11px]">
          <button className="text-muted underline-offset-2 hover:text-white hover:underline" onClick={() => soloCat(null, all)}>Show all</button>
          <span className="text-line">·</span>
          <span className="text-muted">click a dot to solo</span>
        </div>
        <ul className="space-y-0.5">
          {data.meta.categories.map((c) => {
            const on = !hiddenCats.has(c.id);
            return (
              <li key={c.id} className="group flex items-center gap-2">
                <button onClick={() => soloCat(c.id, all)} title={`Only ${c.label}`} className="h-3 w-3 shrink-0 rounded-full ring-2 ring-transparent transition hover:ring-white/40" style={{ background: c.color, opacity: on ? 1 : 0.25 }} />
                <button onClick={() => toggleCat(c.id)} className={`flex flex-1 items-center justify-between rounded-md px-1.5 py-1 text-left text-[13px] transition hover:bg-white/5 ${on ? "text-white" : "text-muted line-through decoration-white/20"}`}>
                  <span className="truncate">{c.label}</span>
                  <span className="font-mono text-[11px] text-muted">{c.n}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <h3 className="mb-2 mt-6 text-[11px] uppercase tracking-[.18em] text-muted">Religions</h3>
        <div className="mb-2 flex gap-2 text-[11px]"><button className="text-muted hover:text-white hover:underline" onClick={() => soloRel(null, allRels)}>All</button><span className="text-muted">· dot = only this one</span></div>
        <ul className="space-y-0.5">
          {data.religions.religions.map((r) => {
            const on = !hiddenRels.has(r.id);
            return (
              <li key={r.id} className="flex items-center gap-2">
                <button onClick={() => soloRel(r.id, allRels)} title={`Only ${r.label}`} className="h-3 w-3 shrink-0 rounded-full ring-2 ring-transparent hover:ring-white/40" style={{ background: r.color, opacity: on ? 1 : 0.25 }} />
                <button onClick={() => toggleRel(r.id)} className={`flex flex-1 items-center justify-between rounded-md px-1.5 py-0.5 text-left text-[13px] hover:bg-white/5 ${on ? "text-white" : "text-muted line-through decoration-white/20"}`}>
                  <span>{r.label}</span><span className="font-mono text-[11px] text-muted">{relCount(r.id)}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <h3 className="mb-2 mt-6 text-[11px] uppercase tracking-[.18em] text-muted">Impact ripple</h3>
        <label className="flex items-center gap-2 text-[12px] text-muted"><input type="checkbox" checked={ripple} onChange={(e) => setRipple(e.target.checked)} className="accent-[#f5c97a]" /> Show ripple when an event is selected</label>
        {isStaticExport
          ? <p className="mt-2 text-[12px] text-muted">“Explain impact” with your own AI key is available when you run Echoes locally.</p>
          : <a href="/profile" className="mt-2 block text-[12px] text-[#d8b4fe] underline-offset-2 hover:underline">AI provider for “Explain impact” (profile)…</a>}

        <h3 className="mb-2 mt-6 text-[11px] uppercase tracking-[.18em] text-muted">Regions</h3>
        <div className="flex flex-wrap gap-1.5">
          {data.meta.regions.map((r) => {
            const on = !hiddenRegions.has(r.id);
            return (
              <button key={r.id} onClick={() => toggleRegion(r.id)}
                className={`rounded-full border px-2.5 py-1 text-[12px] transition ${on ? "border-white/15 bg-white/5 text-white" : "border-line text-muted"}`}>
                {r.label} <span className="font-mono text-[10px] text-muted">{regionCount(r.id)}</span>
              </button>
            );
          })}
        </div>

        <h3 className="mb-2 mt-6 text-[11px] uppercase tracking-[.18em] text-muted">Notability</h3>
        <label className="block text-[12px] text-muted">
          Hide events with fewer than <span className="font-mono text-white">{minFame}</span> Wikipedia language editions
          <input type="range" min={0} max={120} step={5} value={minFame} onChange={(e) => setMinFame(+e.target.value)} className="mt-2 w-full accent-[#f5c97a]" />
        </label>

        <h3 className="mb-2 mt-6 text-[11px] uppercase tracking-[.18em] text-muted">Time scale</h3>
        <div className="flex rounded-lg border border-line p-0.5 text-[12px]">
          {(["deep", "linear"] as const).map((m) => (
            <button key={m} onClick={() => setScale(m)} className={`flex-1 rounded-md py-1.5 transition ${scale === m ? "bg-white/10 text-white" : "text-muted"}`}>
              {m === "deep" ? "Deep time (log)" : "Linear"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">Deep time stretches recent centuries and compresses the ancient past so every era stays readable.</p>

        <div className="mt-6 rounded-lg border border-line p-3 text-[11px] leading-relaxed text-muted">
          <span className="text-white">{data.meta.counts.events.toLocaleString()}</span> events ·{" "}
          <span className="text-white">{data.meta.counts.edges.toLocaleString()}</span> connections. Data: Wikidata (CC0) &amp; Wikipedia (CC BY-SA 4.0), fetched {data.meta.fetchedAt.slice(0, 10)}.
        </div>
      </div>
    </motion.aside>
  );
}
