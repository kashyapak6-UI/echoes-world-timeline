"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dataset, EventItem } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useFilteredEvents } from "@/lib/filter";
import { NOW, fromU, ticks, toU } from "@/lib/scale";
import { fmtRange, fmtYear } from "@/lib/format";
import { EDGE_META } from "@/lib/edges";
import { computeRipple } from "@/lib/ripple";

const AXIS_H = 30;
const ERA_ROW = 16;
const MIN_YEAR = -9999;
type Hit = { x: number; y: number; w: number; h: number; ev: EventItem };

export function TimelineCanvas({ data }: { data: Dataset }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [hover, setHover] = useState<{ ev: EventItem; x: number; y: number } | null>(null);
  const hits = useRef<Hit[]>([]);
  const centers = useRef(new Map<string, [number, number]>());
  const filtered = useFilteredEvents(data);
  const range = useStore((s) => s.range);
  const setRange = useStore((s) => s.setRange);
  const mode = useStore((s) => s.scale);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const hiddenRegions = useStore((s) => s.hiddenRegions);
  const hiddenCats = useStore((s) => s.hiddenCats);
  const rippleOn = useStore((s) => s.ripple);
  const aiState = useStore((s) => (selected ? s.ai[selected] : undefined));
  const ripple = useMemo(() => {
    const ev = selected ? data.byId.get(selected) : null;
    if (!ev || !rippleOn) return null;
    const r = computeRipple(data, ev, aiState?.items);
    const lanes = new Map<string, number>();
    for (const c of r.countries) { const reg = data.countries[c.cc]?.r; if (reg) lanes.set(reg, Math.max(lanes.get(reg) ?? 0, c.strength)); }
    return { r, lanes, ev };
  }, [selected, rippleOn, data, aiState]);

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const lanes = useMemo(() => data.meta.regions.filter((r) => !hiddenRegions.has(r.id)), [data, hiddenRegions]);
  const connected = useMemo(() => {
    if (!selected) return null;
    return new Set([selected, ...(data.adj.get(selected) ?? []).map((a) => a.other)]);
  }, [selected, data]);

  // ---- draw ----
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const { w: W, h: H } = size;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const u0 = toU(range[0], mode), u1 = toU(range[1], mode);
    const X = (y: number) => ((toU(y, mode) - u0) / (u1 - u0)) * W;
    const vis = filtered.filter((e) => e.e >= range[0] && e.s <= range[1]);
    const eras = hiddenCats.has("era") ? [] : vis.filter((e) => e.c === "era");
    const evs = vis.filter((e) => e.c !== "era");
    const newHits: Hit[] = [];
    const newCenters = new Map<string, [number, number]>();

    // grid + axis
    const tk = ticks(u0, u1, W, mode);
    ctx.font = "11px var(--font-mono), monospace";
    ctx.textBaseline = "middle";
    for (const t of tk) {
      const x = X(t);
      ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 0.5, AXIS_H); ctx.lineTo(x + 0.5, H); ctx.stroke();
      ctx.fillStyle = "#8a90a6"; ctx.textAlign = "center";
      ctx.fillText(fmtYear(t), x, AXIS_H / 2);
    }
    ctx.strokeStyle = "#1d2130"; ctx.beginPath(); ctx.moveTo(0, AXIS_H + 0.5); ctx.lineTo(W, AXIS_H + 0.5); ctx.stroke();

    // era lane
    let top = AXIS_H + 4;
    if (eras.length) {
      const rows: number[] = [];
      for (const e of [...eras].sort((a, b) => b.e - b.s - (a.e - a.s))) {
        const x0 = Math.max(-2, X(e.s)), x1 = Math.min(W + 2, X(e.e));
        let r = rows.findIndex((end) => end < x0 - 2);
        if (r === -1) { if (rows.length < 3) { r = rows.length; rows.push(0); } else continue; }
        rows[r] = x1;
        const y = top + r * ERA_ROW;
        const dim = connected && !connected.has(e.id);
        ctx.globalAlpha = dim ? 0.2 : 0.9;
        ctx.fillStyle = "rgba(148,163,184,0.14)"; ctx.strokeStyle = "rgba(148,163,184,0.35)";
        roundRect(ctx, x0, y, Math.max(3, x1 - x0), ERA_ROW - 3, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#cbd2e3"; ctx.textAlign = "left"; ctx.font = "10px var(--font-body), sans-serif";
        clipText(ctx, e.t, Math.max(x0, 0) + 5, y + (ERA_ROW - 3) / 2, x1 - Math.max(x0, 0) - 8);
        newHits.push({ x: x0, y, w: x1 - x0, h: ERA_ROW - 3, ev: e });
        newCenters.set(e.id, [(Math.max(x0, 0) + Math.min(x1, W)) / 2, y + 6]);
      }
      ctx.globalAlpha = 1;
      top += rows.length * ERA_ROW + 6;
    }

    // lane packing
    const byLane = new Map<string, EventItem[]>();
    for (const l of lanes) byLane.set(l.id, []);
    for (const e of evs) byLane.get(e.r)?.push(e);
    type Placed = { ev: EventItem; x0: number; x1: number; row: number; span: boolean };
    const placedByLane = new Map<string, { placed: Placed[]; rows: number }>();
    const avail = H - top - 4;
        for (const l of lanes) {
      // points pack into their own rows on top; spans (wars, empires…) into rows underneath
      const all = byLane.get(l.id)!.slice().sort((a, b) => a.s - b.s || b.sl - a.sl);
      const placed: Placed[] = [];
      const pack = (items: EventItem[], cap: number, offset: number, asSpan: boolean) => {
        const ends: number[] = [];
        for (const ev of items) {
          const x0 = X(ev.s);
          const x1 = asSpan ? X(ev.e) : x0 + 9;
          let r = ends.findIndex((end) => end < x0 - 2);
          if (r === -1) {
            if (ends.length < cap) { r = ends.length; ends.push(0); }
            else { r = ends.indexOf(Math.min(...ends)); }
          }
          ends[r] = Math.max(ends[r], x1);
          placed.push({ ev, x0, x1, row: offset + r, span: asSpan });
        }
        return ends.length;
      };
      const isSpan = (ev: EventItem) => X(ev.e) - X(ev.s) > 6;
      const pr = pack(all.filter((e) => !isSpan(e)), 8, 0, false);
      const sr = pack(all.filter(isSpan), 5, pr, true);
      const ends = { length: pr + sr };
      placedByLane.set(l.id, { placed, rows: Math.max(1, ends.length) });
    }
    // fit lanes to available height
    const totalRows = [...placedByLane.values()].reduce((a, b) => a + b.rows, 0);
    const LANE_PAD = 10;
    let rowH = Math.min(20, Math.max(5, (avail - lanes.length * LANE_PAD) / Math.max(1, totalRows)));
    if (!isFinite(rowH)) rowH = 12;

    let y = top;
    lanes.forEach((l, li) => {
      const info = placedByLane.get(l.id)!;
      const laneH = info.rows * rowH + LANE_PAD;
      ctx.fillStyle = li % 2 ? "rgba(255,255,255,0.012)" : "rgba(255,255,255,0.028)";
      ctx.fillRect(0, y, W, laneH);
      const rs = ripple?.lanes.get(l.id);
      if (ripple && rs) {
        // impact ripple: tint affected lanes, and mark the time window searched for linked events
        const a = Math.min(0.22, 0.05 + rs * 0.025);
        ctx.fillStyle = `rgba(245,201,122,${a * 0.5})`; ctx.fillRect(0, y, W, laneH);
        const wx0 = Math.max(0, X(ripple.ev.s)), wx1 = Math.min(W, X(ripple.r.windowEnd));
        if (wx1 > wx0) {
          const gr = ctx.createLinearGradient(wx0, 0, wx1, 0);
          gr.addColorStop(0, `rgba(245,201,122,${a + 0.08})`); gr.addColorStop(1, "rgba(245,201,122,0)");
          ctx.fillStyle = gr; ctx.fillRect(wx0, y, wx1 - wx0, laneH);
        }
        ctx.fillStyle = "rgba(245,201,122,0.9)"; ctx.fillRect(0, y, 3, laneH);
      }
      const labelEnds: number[] = new Array(info.rows).fill(-1e9);
      // spans first, then points on top
      const ordered = [...info.placed.filter((p) => p.span), ...info.placed.filter((p) => !p.span)];
      for (const p of ordered) {
        const ev = p.ev;
        const color = data.colorOf(ev);
        const cy = y + LANE_PAD / 2 + p.row * rowH + rowH / 2;
        const dim = connected && !connected.has(ev.id);
        ctx.globalAlpha = dim ? 0.12 : 1;
        if (p.span) {
          const x0 = Math.max(-4, p.x0), x1 = Math.min(W + 4, p.x1);
          const h = Math.max(3, rowH - 4);
          const polity = ev.c === "empire" || ev.c === "dynasty";
          ctx.fillStyle = hexA(color, polity ? 0.13 : 0.3); ctx.strokeStyle = hexA(color, polity ? 0.4 : 0.75); ctx.lineWidth = 1;
          roundRect(ctx, x0, cy - h / 2, x1 - x0, h, Math.min(4, h / 2)); ctx.fill(); ctx.stroke();
          ctx.fillStyle = color; ctx.fillRect(x0, cy - h / 2, 2, h);
          if (rowH >= 12 && x1 - x0 > 40) {
            ctx.fillStyle = "#e8eaf2"; ctx.font = "11px var(--font-body), sans-serif"; ctx.textAlign = "left";
            clipText(ctx, ev.t, Math.max(x0, 0) + 6, cy, x1 - Math.max(x0, 0) - 10);
          }
          newHits.push({ x: x0, y: cy - h / 2, w: x1 - x0, h, ev });
          newCenters.set(ev.id, [(Math.max(x0, 0) + Math.min(x1, W)) / 2, cy]);
        } else {
          const r = Math.min(Math.max(2.2, Math.sqrt(ev.sl) / 2.2), rowH / 2 - 0.5, 6.5);
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(p.x0 + 4, cy, r, 0, Math.PI * 2); ctx.fill();
          if (ev.sl > 90) { ctx.strokeStyle = hexA(color, 0.45); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x0 + 4, cy, r + 2.5, 0, Math.PI * 2); ctx.stroke(); }
          // label when there is room in this row
          if (rowH >= 12) {
            ctx.font = "11px var(--font-body), sans-serif";
            const tw = Math.min(ctx.measureText(ev.t).width, 170);
            const lx = p.x0 + 4 + r + 4;
            const nextStart = info.placed.find((q) => q.row === p.row && q.x0 > p.x0 + 1)?.x0 ?? 1e9;
            if (lx > labelEnds[p.row] && lx + tw < nextStart - 4) {
              ctx.fillStyle = dim ? "#e8eaf2" : "#c9cee0"; ctx.textAlign = "left";
              clipText(ctx, ev.t, lx, cy, 170);
              labelEnds[p.row] = lx + tw + 6;
            }
          }
          newHits.push({ x: p.x0 + 4 - 6, y: cy - 7, w: 12, h: 14, ev });
          newCenters.set(ev.id, [p.x0 + 4, cy]);
        }
      }
      ctx.globalAlpha = 1;
      // lane label
      const g = ctx.createLinearGradient(0, 0, 190, 0);
      g.addColorStop(0, "rgba(7,8,12,0.92)"); g.addColorStop(1, "rgba(7,8,12,0)");
      ctx.fillStyle = g; ctx.fillRect(0, y, 190, Math.min(laneH, 22));
      ctx.fillStyle = "#e8eaf2"; ctx.font = "600 10px var(--font-body), sans-serif"; ctx.textAlign = "left";
      ctx.fillText(l.label.toUpperCase(), 10, y + 10);
      ctx.fillStyle = "#8a90a6"; ctx.font = "10px var(--font-mono), monospace";
      const cw = ctx.measureText(l.label.toUpperCase()).width * 1.12 + 8;
      ctx.fillText(String(info.placed.length), 10 + cw, y + 10);
      if (ripple?.lanes.get(l.id)) { ctx.fillStyle = "#f5c97a"; ctx.fillText(ripple.ev.r === l.id ? "◉ ripple origin" : "≋ ripple", 10 + cw + 34, y + 10); }
      y += laneH;
    });

    // "now" line
    const xn = X(2026);
    if (xn > 0 && xn < W) {
      ctx.strokeStyle = "rgba(245,201,122,0.5)"; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(xn, AXIS_H); ctx.lineTo(xn, H); ctx.stroke(); ctx.setLineDash([]);
    }

    // connection arcs
    if (selected) {
      const c0 = newCenters.get(selected);
      const links = data.adj.get(selected) ?? [];
      let offLeft = 0, offRight = 0;
      for (const l of links) {
        const c1 = newCenters.get(l.other);
        const meta = EDGE_META[l.edge.k];
        if (!c0 || !c1) {
          const o = data.byId.get(l.other);
          if (o && o.e < range[0]) offLeft++; else if (o && o.s > range[1]) offRight++;
          continue;
        }
        const [ax, ay] = c0, [bx, by] = c1;
        const lift = Math.min(160, 30 + Math.abs(bx - ax) * 0.25);
        const cx = (ax + bx) / 2, cy = Math.min(ay, by) - lift;
        ctx.strokeStyle = meta.color; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.9;
        if (l.edge.k === "shared") ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(cx, Math.max(AXIS_H + 4, cy), bx, by); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = meta.color; ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2); ctx.fill();
        const o = data.byId.get(l.other)!;
        ctx.font = "11px var(--font-body), sans-serif"; ctx.textAlign = "left";
        const label = o.t.length > 40 ? o.t.slice(0, 39) + "…" : o.t;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(7,8,12,0.85)"; roundRect(ctx, bx + 6, by - 9, tw + 10, 18, 4); ctx.fill();
        ctx.fillStyle = meta.color; ctx.fillText(label, bx + 11, by);
        ctx.globalAlpha = 1;
      }
      if (c0) {
        const [ax, ay] = c0;
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ax, ay, 9, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "rgba(245,201,122,0.35)"; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(ax, ay, 14, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.font = "11px var(--font-body), sans-serif";
      if (offLeft) { ctx.fillStyle = "#f5c97a"; ctx.textAlign = "left"; ctx.fillText(`◀ ${offLeft} connection${offLeft > 1 ? "s" : ""} earlier`, 200, H - 12); }
      if (offRight) { ctx.fillStyle = "#f5c97a"; ctx.textAlign = "right"; ctx.fillText(`${offRight} connection${offRight > 1 ? "s" : ""} later ▶`, W - 12, H - 12); }
    }
    hits.current = newHits;
    centers.current = newCenters;
  }, [size, range, mode, filtered, lanes, selected, connected, data, hiddenCats, ripple]);

  // ---- interaction ----
  const drag = useRef<{ x: number; u0: number; u1: number; moved: boolean } | null>(null);
  const clampSet = (a: number, b: number) => {
    const lo = toU(MIN_YEAR, mode), hi = toU(NOW, mode);
    let width = b - a;
    const minW = toU(fromU(b, mode), mode) - toU(fromU(b, mode) - 2, mode);
    width = Math.min(Math.max(width, minW), hi - lo);
    if (a < lo) { a = lo; b = a + width; }
    if (a + width > hi) { b = hi; a = b - width; } else b = a + width;
    setRange([fromU(a, mode), fromU(b, mode)]);
  };
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [ra, rb] = useStore.getState().range;
      const u0 = toU(ra, mode), u1 = toU(rb, mode);
      const rect = el.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const d = ((e.shiftKey ? e.deltaY : e.deltaX) / rect.width) * (u1 - u0);
        clampSet(u0 + d, u1 + d);
      } else {
        const k = Math.exp(e.deltaY * 0.0016);
        const um = u0 + fx * (u1 - u0);
        clampSet(um - (um - u0) * k, um + (u1 - um) * k);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const hitAt = (x: number, y: number) => {
    let best: Hit | null = null;
    for (const h of hits.current) if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) { if (!best || h.w < best.w || h.ev.sl > best.ev.sl) best = h; }
    return best;
  };

  return (
    <div ref={wrap} className="relative h-full w-full select-none overflow-hidden">
      <canvas ref={canvas} style={{ width: size.w, height: size.h }} className="block cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, u0: toU(range[0], mode), u1: toU(range[1], mode), moved: false };
        }}
        onPointerMove={(e) => {
          const rect = canvas.current!.getBoundingClientRect();
          const x = e.clientX - rect.left, y = e.clientY - rect.top;
          if (drag.current) {
            const dx = e.clientX - drag.current.x;
            if (Math.abs(dx) > 3) drag.current.moved = true;
            if (drag.current.moved) {
              const d = (-dx / size.w) * (drag.current.u1 - drag.current.u0);
              clampSet(drag.current.u0 + d, drag.current.u1 + d);
              setHover(null);
              return;
            }
          }
          const h = hitAt(x, y);
          setHover(h ? { ev: h.ev, x, y } : null);
        }}
        onPointerUp={(e) => {
          const d = drag.current; drag.current = null;
          if (d && !d.moved) {
            const rect = canvas.current!.getBoundingClientRect();
            const h = hitAt(e.clientX - rect.left, e.clientY - rect.top);
            select(h ? h.ev.id : null);
          }
        }}
        onPointerLeave={() => setHover(null)}
        aria-label="Zoomable timeline of world events. Scroll to zoom, drag to pan, click an event for details."
        role="img"
      />
      {hover && (
        <div className="glass pointer-events-none absolute z-10 max-w-xs rounded-xl px-3 py-2 text-sm shadow-xl"
          style={{ left: Math.min(hover.x + 14, size.w - 300), top: Math.min(hover.y + 14, size.h - 110) }}>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider" style={{ color: data.colorOf(hover.ev) }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: data.colorOf(hover.ev) }} />
            {hover.ev.rel ? data.relById[hover.ev.rel]?.label : data.meta.categories.find((c) => c.id === hover.ev.c)?.label}
          </div>
          <div className="mt-0.5 font-medium leading-snug">{hover.ev.t}</div>
          <div className="font-mono text-[11px] text-muted">{fmtRange(hover.ev.s, hover.ev.e, hover.ev.p)}</div>
          {hover.ev.d && <div className="mt-1 text-[12px] leading-snug text-muted">{hover.ev.d}</div>}
          {(data.adj.get(hover.ev.id)?.length ?? 0) > 0 && <div className="mt-1 text-[11px] text-gold">{data.adj.get(hover.ev.id)!.length} connections · click to explore</div>}
          <div className="mt-1 text-[10px] text-muted">Source: {hover.ev.w ? `Wikipedia “${hover.ev.w}”${hover.ev.xr ? ` rev ${hover.ev.xr}` : ""} · ` : ""}Wikidata {hover.ev.id}{hover.ev.src?.length ? ` · +${hover.ev.src.length} refs` : ""}</div>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-muted">Scroll to zoom · drag to pan · click for details</div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), r);
}
function clipText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number) {
  if (maxW < 12) return;
  let t = text;
  if (ctx.measureText(t).width > maxW) {
    while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    t += "…";
  }
  ctx.fillText(t, x, y);
}
function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
