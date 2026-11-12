// Years are astronomical (0 = 1 BCE). Display in BCE/CE.
export function fmtYear(y: number, prec = 9): string {
  const yr = Math.floor(y + 1e-6);
  let human = yr <= 0 ? 1 - yr : yr;
  // coarse BCE dates (decade/century/millennium precision) read better rounded: "c. 9000 BCE", not "c. 9001 BCE"
  if (yr <= 0 && prec < 9 && human % 10 === 1) human -= 1;
  const era = yr <= 0 ? " BCE" : yr < 1000 ? " CE" : "";
  const approx = prec < 9 ? "c. " : "";
  return `${approx}${human.toLocaleString("en-US", { useGrouping: human >= 10000 })}${era}`;
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(y: number, prec: number): string {
  if (prec >= 10 && y > 0) {
    const yr = Math.floor(y + 1e-6);
    const m = Math.min(11, Math.floor((y - yr) * 12 + 1e-6));
    return `${MONTHS[m]} ${yr}`;
  }
  return fmtYear(y, prec);
}
export function fmtRange(s: number, e: number, p: number): string {
  if (Math.floor(e) === Math.floor(s) || e - s < 0.5) return fmtDate(s, p);
  return `${fmtDate(s, p)} – ${fmtDate(e, p)}`;
}
export function fmtSpan(years: number | null): string {
  if (years == null) return "—";
  if (years < 1) return `${Math.max(1, Math.round(years * 12))} mo`;
  if (years < 10) return `${years.toFixed(1)} yrs`;
  return `${Math.round(years).toLocaleString()} yrs`;
}
export function fmtCentury(c: number): string {
  // c = floor(year/100). astronomical; century label approx.
  const start = c * 100;
  if (start >= 0) { const n = c + 1; return `${n}${ord(n)} c. CE`; }
  const n = -c; return `${n}${ord(n)} c. BCE`;
}
function ord(n: number) { const s = ["th", "st", "nd", "rd"], v = n % 100; return s[(v - 20) % 10] || s[v] || s[0]; }
export const wikiUrl = (t: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, "_"))}`;
export const wdUrl = (q: string) => `https://www.wikidata.org/wiki/${q}`;

export const wikiRevUrl = (t: string, rev: number | null) => (rev ? `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(t.replace(/ /g, "_"))}&oldid=${rev}` : wikiUrl(t));
export const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
