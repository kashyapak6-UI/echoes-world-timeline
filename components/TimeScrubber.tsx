"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import type { Dataset } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useFilteredEvents } from "@/lib/filter";
import { NOW, fromU, ticks, toU } from "@/lib/scale";
import { fmtYear } from "@/lib/format";
import { animateRange } from "@/lib/focus";

const MIN_YEAR = -9999;
const PRESETS: { label: string; r: [number, number] }[] = [
  { label: "All", r: [-9999, 2026] },
  { label: "Ancient", r: [-3499, -499] },
  { label: "Classical", r: [-799, 600] },
  { label: "Medieval", r: [500, 1500] },
  { label: "Early modern", r: [1450, 1800] },
  { label: "Modern", r: [1789, 1945] },
  { label: "Since 1945", r: [1945, 2026] },
];

export function TimeScrubber({ data }: { data: Dataset }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  const H = 54;
  const range = useStore((s) => s.range);
  const setRange = useStore((s) => s.setRange);
  const mode = useStore((s) => s.scale);
  const view = useStore((s) => s.view);
  const filtered = useFilteredEvents(data);
  const [playing, setPlaying] = useState(false);
  const lo = toU(MIN_YEAR, mode), hi = toU(NOW, mode);
  const X = (y: number) => ((toU(y, mode) - lo) / (hi - lo)) * w;

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const bins = useMemo(() => {
    const n = Math.max(40, Math.floor(w / 3));
    const b = new Array(n).fill(0);
    for (const e of filtered) {
      if (e.c === "era") continue;
      const i = Math.floor(((toU(e.s, mode) - lo) / (hi - lo)) * n);
      if (i >= 0 && i < n) b[i]++;
    }
    return b;
  }, [filtered, mode, lo, hi, w]);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = H * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, H);
    const max = Math.max(...bins, 1);
    const bw = w / bins.length;
    bins.forEach((v, i) => {
      const h = (Math.sqrt(v) / Math.sqrt(max)) * (H - 18);
      ctx.fillStyle = "rgba(124,196,255,0.35)";
      ctx.fillRect(i * bw, H - 14 - h, Math.max(1, bw - 1), h);
    });
    ctx.font = "10px var(--font-mono), monospace"; ctx.fillStyle = "#5d6378"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    for (const t of ticks(lo, hi, w, mode)) ctx.fillText(fmtYear(t), X(t), H);
    const a = X(range[0]), b = X(range[1]);
    ctx.fillStyle = "rgba(7,8,12,0.55)"; ctx.fillRect(0, 0, a, H - 12); ctx.fillRect(b, 0, w - b, H - 12);
    ctx.fillStyle = "rgba(245,201,122,0.12)"; ctx.fillRect(a, 0, Math.max(2, b - a), H - 12);
    ctx.strokeStyle = "#f5c97a"; ctx.lineWidth = 1.5; ctx.strokeRect(a + 0.75, 0.75, Math.max(2, b - a) - 1.5, H - 13.5);
    ctx.fillStyle = "#f5c97a"; ctx.fillRect(a - 2, 10, 4, H - 34); ctx.fillRect(b - 2, 10, 4, H - 34);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bins, range, w, mode]);

  // drag: move window or resize edges
  const drag = useRef<{ kind: "move" | "a" | "b" | "new"; x: number; ua: number; ub: number } | null>(null);
  const uAt = (px: number) => lo + (px / w) * (hi - lo);
  const set = (ua: number, ub: number) => {
    ua = Math.max(lo, ua); ub = Math.min(hi, ub);
    if (ub - ua < 0.0005) return;
    setRange([fromU(ua, mode), fromU(ub, mode)]);
  };

  // playback: slide the window toward the present
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const [ra, rb] = useStore.getState().range;
      const ua = toU(ra, mode), ub = toU(rb, mode);
      const step = (ub - ua) * 0.006;
      if (ub + step >= hi) { setPlaying(false); return; }
      setRange([fromU(ua + step, mode), fromU(ub + step, mode)]);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, mode, hi, setRange]);

  return (
    <div className="relative z-10 shrink-0 border-t border-line bg-panel/80 px-4 pb-2 pt-2 backdrop-blur">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <button onClick={() => {
          if (!playing && toU(range[1], mode) >= hi - 0.001) { const width = toU(range[1], mode) - toU(range[0], mode); setRange([fromU(lo, mode), fromU(lo + width, mode)]); }
          setPlaying(!playing);
        }} className="grid h-7 w-7 place-items-center rounded-full bg-gold text-ink transition hover:scale-105" aria-label={playing ? "Pause" : "Play through history"}>
          {playing ? <Pause size={13} /> : <Play size={13} className="translate-x-px" />}
        </button>
        <div className="font-mono text-[12px] text-white">{fmtYear(range[0])} <span className="text-muted">→</span> {fmtYear(range[1])}</div>
        <div className="text-[11px] text-muted">{view === "map" ? "· map shows events in this window — drag it to scrub" : "· drag the window or zoom the timeline"}</div>
        <div className="flex-1" />
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => { setPlaying(false); animateRange(range, p.r); }}
              className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-muted transition hover:border-gold/50 hover:text-white">{p.label}</button>
          ))}
        </div>
      </div>
      <div ref={wrap} className="relative">
        <canvas ref={ref} style={{ width: w, height: H }} className="block cursor-ew-resize" aria-label="Time window scrubber"
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            setPlaying(false);
            const x = e.nativeEvent.offsetX, a = X(range[0]), b = X(range[1]);
            const kind = Math.abs(x - a) < 8 ? "a" : Math.abs(x - b) < 8 ? "b" : x > a && x < b ? "move" : "new";
            drag.current = { kind, x, ua: toU(range[0], mode), ub: toU(range[1], mode) };
            if (kind === "new") { const width = drag.current.ub - drag.current.ua; const c = uAt(x); set(c - width / 2, c + width / 2); drag.current = { kind: "move", x, ua: c - width / 2, ub: c + width / 2 }; }
          }}
          onPointerMove={(e) => {
            const d = drag.current; if (!d) return;
            const du = ((e.nativeEvent.offsetX - d.x) / w) * (hi - lo);
            if (d.kind === "move") { const width = d.ub - d.ua; let na = d.ua + du; na = Math.max(lo, Math.min(hi - width, na)); set(na, na + width); }
            if (d.kind === "a") set(Math.min(d.ua + du, d.ub - 0.001), d.ub);
            if (d.kind === "b") set(d.ua, Math.max(d.ub + du, d.ua + 0.001));
          }}
          onPointerUp={() => (drag.current = null)}
        />
      </div>
    </div>
  );
}
