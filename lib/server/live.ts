import "server-only";
import { LIVE_SOURCES, hostName, type LiveItem, type LiveResult, type OnThisDayItem } from "@/lib/live";
import { write, read } from "./store";
import https from "node:https";

/** GET via node:https — GDELT can take >10 s just to accept a connection, longer than fetch()'s fixed connect timeout. */
function httpsText(url: URL, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": UA } }, (res) => {
      let data = ""; res.setEncoding("utf8");
      res.on("data", (c) => (data += c)); res.on("end", () => resolve(data)); res.on("error", reject);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout after ${timeoutMs / 1000}s`)));
    req.on("error", reject);
  });
}

const UA = "Echoes/0.2 (open-data history explorer; https://github.com/)";
const cache = new Map<string, { at: number; ttl: number; v: unknown; ok: boolean }>();
/** Cache with TTL; failures are cached for 60 s (no hammering) and fall back to the last good result, marked stale. */
async function cached<T extends object>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const c = cache.get(key);
  if (c && Date.now() - c.at < (c.ok ? c.ttl : 60_000)) return { ...(c.v as T), cached: true };
  const v = await fn();
  const err = (v as { error?: string }).error;
  if (!err) { cache.set(key, { at: Date.now(), ttl: ttlMs, v, ok: true }); cache.set(`good:${key}`, { at: Date.now(), ttl: 6 * 3600_000, v, ok: true }); return v; }
  const good = cache.get(`good:${key}`);
  const out = good && Date.now() - good.at < good.ttl ? { ...(good.v as T), cached: true, note: `Showing results from ${new Date(good.at).toISOString().slice(11, 16)} UTC — live refresh failed: ${err}` } : v;
  cache.set(key, { at: Date.now(), ttl: 60_000, v: out, ok: false });
  return out;
}
const now = () => new Date().toISOString();

// ---- GDELT: the DOC API allows ~1 request / 5 s, so all calls go through one throttled queue ----
let gdeltQueue: Promise<unknown> = Promise.resolve();
let lastGdelt = 0;
function gdeltFetch(params: Record<string, string>) {
  const run = async () => {
    const wait = Math.max(0, lastGdelt + 5500 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const u = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
    u.search = new URLSearchParams({ mode: "artlist", format: "json", sort: "datedesc", ...params }).toString();
    for (let i = 0; i < 3; i++) {
      lastGdelt = Date.now();
      let text: string;
      try {
        text = await httpsText(u, 40_000);
      } catch (e) {
        if (i < 2) { await new Promise((r) => setTimeout(r, 6000)); continue; }
        throw new Error(`GDELT unreachable (${(e as Error).message})`);
      }
      lastGdelt = Date.now();
      if (text.startsWith("{")) return JSON.parse(text) as { articles?: { url: string; title: string; seendate: string; domain: string; sourcecountry?: string; language?: string }[] };
      if (/limit requests/i.test(text) && i < 2) { await new Promise((r) => setTimeout(r, 10_000)); continue; }
      throw new Error(/limit requests/i.test(text) ? "GDELT is rate-limiting this server (1 request / 5 s per IP) — try again in a minute" : `GDELT: ${text.slice(0, 120)}`);
    }
    throw new Error("GDELT unavailable");
  };
  const p = gdeltQueue.then(run, run);
  gdeltQueue = p.catch(() => {});
  return p;
}
const gdeltDate = (s: string) => s?.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z");

export async function gdeltNews(query: string, timespan = "1d", max = 60): Promise<LiveResult<LiveItem>> {
  return cached(`gdelt:${query}:${timespan}:${max}`, 15 * 60_000, async () => {
    try {
      const j = await gdeltFetch({ query, timespan, maxrecords: String(max) });
      const items: LiveItem[] = (j.articles ?? []).map((a, i) => ({
        id: `gdelt-${i}-${a.url}`, kind: "news", provider: "GDELT", title: a.title, url: a.url, outlet: a.domain, date: gdeltDate(a.seendate), country: a.sourcecountry || undefined,
      }));
      return { items, source: LIVE_SOURCES.gdelt, fetchedAt: now() };
    } catch (e) { return { items: [], source: LIVE_SOURCES.gdelt, fetchedAt: now(), error: String((e as Error).message) }; }
  });
}

export async function usgsQuakes(feed = "4.5_week"): Promise<LiveResult<LiveItem>> {
  if (!/^(significant|4\.5|2\.5|1\.0|all)_(hour|day|week|month)$/.test(feed)) feed = "4.5_week";
  return cached(`usgs:${feed}`, 5 * 60_000, async () => {
    try {
      const res = await fetch(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feed}.geojson`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`USGS HTTP ${res.status}`);
      const j = await res.json();
      const items: LiveItem[] = j.features.map((f: { id: string; properties: { mag: number; place: string; time: number; url: string; title: string }; geometry: { coordinates: number[] } }) => ({
        id: `usgs-${f.id}`, kind: "quake", provider: "USGS", title: f.properties.title, url: f.properties.url, outlet: "earthquake.usgs.gov",
        date: new Date(f.properties.time).toISOString(), mag: f.properties.mag, place: f.properties.place, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
      }));
      return { items, source: LIVE_SOURCES.usgs, fetchedAt: now() };
    } catch (e) { return { items: [], source: LIVE_SOURCES.usgs, fetchedAt: now(), error: String((e as Error).message) }; }
  });
}

export async function onThisDay(m: number, d: number): Promise<LiveResult<OnThisDayItem>> {
  const mm = String(m).padStart(2, "0"), dd = String(d).padStart(2, "0");
  return cached(`otd:${mm}${dd}`, 6 * 3600_000, async () => {
    try {
      const res = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${mm}/${dd}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`Wikimedia HTTP ${res.status}`);
      const j = await res.json();
      type P = { titles: { canonical: string; normalized: string }; content_urls?: { desktop?: { page?: string } }; wikibase_item?: string };
      const map = (arr: { year: number; text: string; pages: P[] }[] = []) => arr.map((e) => ({
        year: e.year, text: e.text,
        pages: e.pages.map((p) => ({ title: p.titles.normalized, url: p.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(p.titles.canonical)}`, qid: p.wikibase_item })),
      }));
      const items = [...map(j.selected), ...map(j.events)];
      const seen = new Set<string>();
      return { items: items.filter((x) => { const k = `${x.year}:${x.text}`; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => b.year - a.year), source: LIVE_SOURCES.otd, fetchedAt: now() };
    } catch (e) { return { items: [], source: LIVE_SOURCES.otd, fetchedAt: now(), error: String((e as Error).message) }; }
  });
}

// ---- optional keyed news APIs, with server-side daily caps ----
type Keyed = "newsdata" | "currents" | "guardian";
const KEYED: Record<Keyed, { env: string; capEnv: string; defCap: number }> = {
  newsdata: { env: "NEWSDATA_API_KEY", capEnv: "NEWSDATA_DAILY_CAP", defCap: 150 },
  currents: { env: "CURRENTS_API_KEY", capEnv: "CURRENTS_DAILY_CAP", defCap: 300 },
  guardian: { env: "GUARDIAN_API_KEY", capEnv: "GUARDIAN_DAILY_CAP", defCap: 400 },
};
const capOf = (k: Keyed) => Math.max(0, Number(process.env[KEYED[k].capEnv] ?? KEYED[k].defCap) || 0);
const dayKey = (k: Keyed) => `${k}:${new Date().toISOString().slice(0, 10)}`;
export function keyedStatus() {
  return (Object.keys(KEYED) as Keyed[]).map((k) => ({ id: k, name: LIVE_SOURCES[k].name, configured: !!process.env[KEYED[k].env], cap: capOf(k), used: read((d) => d.caps[dayKey(k)] ?? 0), env: KEYED[k].env, capEnv: KEYED[k].capEnv }));
}
async function spend(k: Keyed) {
  return write((d) => {
    for (const key of Object.keys(d.caps)) if (!key.endsWith(new Date().toISOString().slice(0, 10))) delete d.caps[key];
    const used = d.caps[dayKey(k)] ?? 0;
    if (used >= capOf(k)) return false;
    d.caps[dayKey(k)] = used + 1; return true;
  });
}
export async function keyedNews(k: Keyed, q: string): Promise<LiveResult<LiveItem>> {
  const key = process.env[KEYED[k].env];
  const source = LIVE_SOURCES[k];
  if (!key) return { items: [], source, fetchedAt: now(), error: `Not configured (set ${KEYED[k].env})` };
  return cached(`${k}:${q}`, 30 * 60_000, async () => {
    if (!(await spend(k))) return { items: [], source, fetchedAt: now(), error: `Daily cap reached (${capOf(k)} requests; ${KEYED[k].capEnv})` };
    try {
      let items: LiveItem[] = [];
      if (k === "newsdata") {
        const u = new URL("https://newsdata.io/api/1/latest"); u.search = new URLSearchParams({ apikey: key, language: "en", ...(q ? { q } : {}) }).toString();
        const j = await (await fetch(u, { signal: AbortSignal.timeout(20_000) })).json();
        if (j.status !== "success") throw new Error(j.results?.message ?? "NewsData.io error");
        items = j.results.map((a: { article_id: string; title: string; link: string; source_name?: string; source_id?: string; pubDate?: string; country?: string[] }) => ({ id: `nd-${a.article_id}`, kind: "news", provider: "NewsData.io", title: a.title, url: a.link, outlet: a.source_name ?? a.source_id ?? hostName(a.link), date: a.pubDate ? new Date(a.pubDate.replace(" ", "T") + "Z").toISOString() : undefined, country: a.country?.[0] }));
      } else if (k === "currents") {
        const u = new URL(q ? "https://api.currentsapi.services/v1/search" : "https://api.currentsapi.services/v1/latest-news"); u.search = new URLSearchParams({ apiKey: key, language: "en", ...(q ? { keywords: q } : {}) }).toString();
        const j = await (await fetch(u, { signal: AbortSignal.timeout(20_000) })).json();
        if (j.status !== "ok") throw new Error(j.msg ?? "Currents error");
        items = j.news.map((a: { id: string; title: string; url: string; published?: string }) => ({ id: `cu-${a.id}`, kind: "news", provider: "Currents", title: a.title, url: a.url, outlet: hostName(a.url), date: a.published ? new Date(a.published.replace(" +0000", "Z").replace(" ", "T")).toISOString() : undefined }));
      } else {
        const u = new URL("https://content.guardianapis.com/search"); u.search = new URLSearchParams({ "api-key": key, "order-by": q ? "relevance" : "newest", "page-size": "20", ...(q ? { q } : {}) }).toString();
        const j = await (await fetch(u, { signal: AbortSignal.timeout(20_000) })).json();
        if (j.response?.status !== "ok") throw new Error(j.response?.message ?? j.message ?? "Guardian error");
        items = j.response.results.map((a: { id: string; webTitle: string; webUrl: string; webPublicationDate: string; sectionName: string }) => ({ id: `gu-${a.id}`, kind: "news", provider: "The Guardian", title: a.webTitle, url: a.webUrl, outlet: "theguardian.com", date: a.webPublicationDate, section: a.sectionName }));
      }
      return { items, source, fetchedAt: now() };
    } catch (e) { return { items: [], source, fetchedAt: now(), error: String((e as Error).message).replace(key, "[key]") }; }
  });
}
export const DEFAULT_NEWS_QUERY = "(war OR election OR earthquake OR protest OR summit OR flood OR ceasefire OR treaty) sourcelang:english";
