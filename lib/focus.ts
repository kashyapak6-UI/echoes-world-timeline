"use client";
import type { Dataset } from "./types";
import { useStore } from "./store";
import { NOW, fromU, toU } from "./scale";

/** Select an event and animate the shared time window so it is centred and readable. */
export function focusEvent(data: Dataset, id: string) {
  const ev = data.byId.get(id);
  const st = useStore.getState();
  st.select(id);
  if (!ev) return;
  if (st.hiddenCats.has(ev.c)) st.toggleCat(ev.c);
  if (st.hiddenRegions.has(ev.r)) st.toggleRegion(ev.r);
  if (ev.sl < st.minFame) st.setMinFame(0);
  const mode = st.scale;
  const [a, b] = st.range;
  const mid = (ev.s + ev.e) / 2;
  const dur = Math.max(ev.e - ev.s, 1);
  // target width in u-space: show the event plus generous context
  const cu = toU(mid, mode);
  const half = Math.max((toU(Math.min(NOW, mid + dur * 3 + 30), mode) - toU(mid - dur * 3 - 30, mode)) / 2, 0.02);
  const target: [number, number] = [fromU(cu - half, mode), Math.min(NOW, fromU(cu + half, mode))];
  animateRange([a, b], target);
}

let raf = 0;
export function animateRange(from: [number, number], to: [number, number], ms = 900) {
  cancelAnimationFrame(raf);
  const mode = useStore.getState().scale;
  const f0 = toU(from[0], mode), f1 = toU(from[1], mode), t0 = toU(to[0], mode), t1 = toU(to[1], mode);
  const start = performance.now();
  const ease = (x: number) => 1 - Math.pow(1 - x, 3);
  const step = (now: number) => {
    const k = ease(Math.min(1, (now - start) / ms));
    useStore.getState().setRange([fromU(f0 + (t0 - f0) * k, mode), fromU(f1 + (t1 - f1) * k, mode)]);
    if (k < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
