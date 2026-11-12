// Deep-time scale: u = -ln(NOW - year + K). K controls how much the recent past is stretched.
export const NOW = 2027;
const K = 300;
export type ScaleMode = "deep" | "linear";
export function toU(y: number, mode: ScaleMode) { return mode === "linear" ? y : -Math.log(NOW - y + K); }
export function fromU(u: number, mode: ScaleMode) { return mode === "linear" ? u : NOW + K - Math.exp(-u); }
const NICE = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];
// ticks: pick a step per pixel-region so labels are ~110px apart
export function ticks(u0: number, u1: number, width: number, mode: ScaleMode): number[] {
  const out: number[] = [];
  const px = (u: number) => ((u - u0) / (u1 - u0)) * width;
  const y0 = fromU(u0, mode), y1 = fromU(u1, mode);
  let y = y0;
  let guard = 0;
  while (y < y1 && guard++ < 400) {
    // local density: years per 110px at this position
    const u = toU(y, mode);
    const yAhead = fromU(u + (110 / width) * (u1 - u0), mode);
    const want = Math.max(1, yAhead - y);
    const step = NICE.find((n) => n >= want) ?? Math.ceil(want / 10000) * 10000;
    const next = Math.ceil((y + 1e-9) / step) * step;
    if (next > y1) break;
    // nice historical years -> astronomical (2000 BCE = -1999; there is no year 0)
    const astro = next < 0 ? next + 1 : next === 0 ? 1 : next;
    if (!out.length || px(toU(astro, mode)) - px(toU(out[out.length - 1], mode)) > 70) out.push(astro);
    y = next + step * 0.5;
  }
  return out;
}
