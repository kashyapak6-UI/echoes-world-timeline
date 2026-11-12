// Build step: turns cached raw fetches into the static JSON the site loads.
// Outputs public/data/{events,edges,patterns,meta,land}.json. Run: node data/build.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "./categories.mjs";
import { RELIGIONS } from "./religions.mjs";
import { TEXTS, SKIPPED } from "./texts.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(DIR, "raw");
const OUT = path.join(DIR, "..", "public", "data");
fs.mkdirSync(OUT, { recursive: true });
const read = (f) => JSON.parse(fs.readFileSync(path.join(RAW, f), "utf8"));

const details = read("details.json");
const relations = read("relations.json");
const optRead = (f, def) => (fs.existsSync(path.join(RAW, f)) ? read(f) : def);
relations.push(...optRead("religion-relations.json", []));
const extLabels = read("external-labels.json");
const extracts = read("wikipedia-extracts.json");
const fetchedAt = read("fetched-at.json").at;

const MIN_YEAR = -10000, MAX_YEAR = 2026;
// Priority when an item is in several categories (most specific pattern first).
const PRIORITY = ["pandemic", "famine", "financial", "atrocity", "assassination", "partition", "migration", "religion", "treaty", "disaster", "revolution", "battle", "war", "tech", "dynasty", "empire", "era"];

// ---- membership: keep top-N by sitelinks per category ----
const catMembers = {};
for (const c of CATEGORIES) {
  const rows = read(`ids-${c.id}.json`);
  const seen = new Set();
  const uniq = rows.filter((r) => (seen.has(r.id) ? false : seen.add(r.id))).sort((a, b) => b.sl - a.sl);
  catMembers[c.id] = uniq.map((r) => r.id);
}

// ---- dates ----
// WDQS returns XSD 1.1 (astronomical) years: "-0489" == 490 BCE. We keep astronomical years internally
// (year 0 = 1 BCE) and format for display on the client.
function parseTime(t) {
  if (!t) return null;
  const m = /^(-?)(\d+)-(\d\d)-(\d\d)T/.exec(t.v);
  if (!m) return null;
  let y = parseInt(m[2], 10) * (m[1] ? -1 : 1);
  const prec = t.prec;
  let frac = 0;
  if (prec >= 10) frac += (parseInt(m[3], 10) - 1) / 12;
  if (prec >= 11) frac += (parseInt(m[4], 10) - 1) / 365;
  return { y: y + frac, prec };
}
function datesFor(d, cat) {
  const span = CATEGORIES.find((c) => c.id === cat)?.span;
  const startKeys = span ? ["P571", "P580", "P585", "P575"] : ["P580", "P585", "P571", "P575"];
  const endKeys = span ? ["P576", "P582"] : ["P582", "P576"];
  let s = null, e = null;
  for (const k of startKeys) if (!s) s = parseTime(d[k]);
  for (const k of endKeys) if (!e) e = parseTime(d[k]);
  if (!s && e) { s = e; }
  if (!s) return null;
  if (!e || e.y < s.y) e = { y: s.y, prec: s.prec };
  // end of a year-precision range covers the whole year
  const endY = e.prec <= 9 && e.y !== s.y ? e.y + 0.999 : e.y;
  return { s: +s.y.toFixed(3), e: +endY.toFixed(3), p: Math.min(s.prec, e.prec) };
}

// ---- region from coordinates (simple, documented lat/lon boxes) ----
export const REGIONS = [
  { id: "eu", label: "Europe" },
  { id: "mena", label: "Middle East & N. Africa" },
  { id: "ssa", label: "Sub-Saharan Africa" },
  { id: "sa", label: "South Asia" },
  { id: "ca", label: "Central & North Asia" },
  { id: "ea", label: "East Asia" },
  { id: "sea", label: "Southeast Asia & Oceania" },
  { id: "na", label: "North America" },
  { id: "la", label: "Latin America & Caribbean" },
  { id: "gl", label: "Global / multi-region" },
];
function regionOf(lat, lon) {
  if (lat == null) return "gl";
  if (lon < -140 || (lon > 141 && lat < -10) || (lon > 110 && lat < -10)) return "sea";
  if (lon < -30) {
    if (lat >= 28 || (lon > -82 && lon < -79 && lat > 24.5)) return "na";
    return "la";
  }
  if (lat >= 35.5 && lon >= -30 && lon <= 30) return "eu";
  if (lat >= 42 && lon <= 60) return "eu";
  if ((lat >= 18 && lon >= -18 && lon <= 63) || (lat >= 12 && lon >= 35 && lon <= 60)) return "mena";
  if (lat < 18 && lon >= -20 && lon <= 52) return "ssa";
  if (lon > 60 && lon <= 92 && lat >= 5 && lat < 37.5) return "sa";
  if (lat >= 37.5 && lon > 50 && lon <= 92) return "ca";
  if (lat >= 50 && lon > 92) return lon > 120 && lat < 55 ? "ea" : "ca";
  if (lon > 92 && lat >= 20) return "ea";
  if (lon > 92) return "sea";
  return "gl";
}
const parsePoint = (s) => {
  const m = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(s ?? "");
  return m ? [+(+m[2]).toFixed(3), +(+m[1]).toFixed(3)] : null; // [lat, lon]
};

// ---- assemble events ----
// "time of discovery or invention" (P575) is also used for places, planets, sports and chemical elements.
// Keep inventions/discoveries: drop items with their own coordinates (places) and these classes.
const TECH_EXCLUDE = new Set(["Q11344", "Q31629", "Q212434", "Q47728", "Q1319599", "Q30014", "Q2199", "Q3504248", "Q3901935", "Q12136", "Q112193867"]);
const techOk = (d) => d.coordSrc !== "P625" && !d.p31.some((x) => TECH_EXCLUDE.has(x));
const keep = new Map();
const stats = { candidates: Object.keys(details).length, noDate: 0, outOfRange: 0, noLabel: 0, techExcluded: 0, multiLocation: 0 };
for (const c of CATEGORIES) {
  let kept = 0;
  for (const id of catMembers[c.id]) {
    if (kept >= c.limit) break;
    const d = details[id];
    if (!d || !d.label || /^Q\d+$/.test(d.label)) { stats.noLabel++; continue; }
    if (c.id === "tech" && !techOk(d)) { stats.techExcluded++; continue; }
    if (keep.has(id)) { keep.get(id).cats.add(c.id); kept++; continue; }
    const cats = new Set([c.id]);
    keep.set(id, { id, d, cats });
    kept++;
  }
}
const events = [];
for (const { id, d, cats } of keep.values()) {
  const primary = PRIORITY.find((p) => cats.has(p));
  const dt = datesFor(d, primary);
  if (!dt) { stats.noDate++; continue; }
  if (dt.s < MIN_YEAR || dt.s > MAX_YEAR + 1) { stats.outOfRange++; continue; }
  if (dt.e > MAX_YEAR + 1) dt.e = MAX_YEAR + 0.99;
  let ll = parsePoint(d.coord);
  let region = regionOf(ll?.[0], ll?.[1]);
  let ml = null;
  // several locations (P276) and no own coordinates: keep them all; multi-region events go to the global lane
  if (d.coordSrc === "P276" && (d.locCoords?.length ?? 0) > 1) {
    ml = d.locCoords.map(parsePoint).filter(Boolean).slice(0, 8);
    const regs = new Set(ml.map((p) => regionOf(p[0], p[1])));
    ll = ml[0];
    region = regs.size > 1 ? "gl" : [...regs][0];
    stats.multiLocation++;
  }
  const ex = d.wiki ? extracts[d.wiki] : null;
  events.push({
    id, t: d.label, d: d.desc ?? "", c: primary, cs: [...cats].filter((x) => x !== primary),
    s: dt.s, e: dt.e, p: dt.p, ll, ...(ml ? { ml } : {}), lsrc: ll ? d.coordSrc : null, r: region,
    w: d.wiki ?? null, x: ex?.text ?? null, xr: ex?.revid ?? null, sl: d.sl,
  });
}
// ---- religion layer (data/fetch-religion.mjs) ----
const relCands = fs.existsSync(path.join(RAW, "religion-candidates.json")) ? read("religion-candidates.json") : [];
const relDetails = fs.existsSync(path.join(RAW, "religion-details.json")) ? read("religion-details.json") : {};
const relStats = Object.fromEntries(RELIGIONS.map((r) => [r.id, { origin: 0, figure: 0, scripture: 0, site: 0, event: 0, tagged: 0 }]));
const relUndated = [];
const byIdTmp = new Map(events.map((e) => [e.id, e]));
const KIND_PROPS = { figure: [["P569"], ["P570"]], origin: [["P571", "P580"], ["P582", "P576"]], scripture: [["P571", "P577", "P580"], ["P582"]], site: [["P571", "P580"], ["P576"]], event: [["P585", "P580", "P571", "P577"], ["P582", "P576"]] };
const fmtY = (y) => { const yr = Math.floor(y); return yr <= 0 ? `${1 - yr} BCE` : `${yr} CE`; };
function pickDate(d, props) {
  for (const p of props) {
    const vals = (d.dates?.[p] ?? []).map((x) => ({ ...parseTime(x), q: x.q, pref: x.pref, prop: p })).filter((x) => x.y != null);
    if (!vals.length) continue;
    const chosen = vals.find((x) => x.pref) ?? [...vals].sort((a, b) => a.y - b.y)[0];
    const distinct = [...new Map(vals.map((x) => [Math.floor(x.y), x])).values()];
    return { chosen, all: distinct };
  }
  return null;
}
const seenRel = new Set();
for (const c of [...relCands].sort((a, b) => (a.kind === "origin" ? -1 : 0) - (b.kind === "origin" ? -1 : 0) || (b.founder ? 1 : 0) - (a.founder ? 1 : 0))) {
  const key = c.id;
  if (seenRel.has(key)) continue;
  seenRel.add(key);
  const existing = byIdTmp.get(c.id);
  if (existing) { existing.rel = c.rel; relStats[c.rel].tagged++; continue; }
  const d = relDetails[c.id];
  if (!d || !d.label) continue;
  const [sp, ep] = KIND_PROPS[c.kind];
  const sd = pickDate(d, sp), ed = pickDate(d, ep);
  if (!sd && !ed) { if (c.kind === "origin") relUndated.push({ rel: c.rel, id: c.id, label: d.label }); continue; }
  const start = sd?.chosen ?? ed.chosen, end = ed?.chosen ?? start;
  if (start.y < MIN_YEAR || start.y > MAX_YEAR + 1) continue;
  // date notes: every recorded alternative value and its qualifiers, never a value we chose ourselves
  const notes = [];
  for (const [label, dd] of [["start", sd], ["end", ed]]) {
    if (!dd) continue;
    const quals = [...new Set(dd.all.flatMap((x) => x.q))];
    if (dd.all.length > 1) notes.push(`Wikidata records several ${c.kind === "figure" ? (label === "start" ? "birth" : "death") : label} dates: ${dd.all.map((x) => `${fmtY(x.y)}${x.q.length ? ` (${x.q.join(", ")})` : ""}${x.pref ? " [preferred]" : ""}`).join("; ")}`);
    else if (quals.length) notes.push(`${c.kind === "figure" ? (label === "start" ? "Birth" : "Death") : label === "start" ? "Date" : "End"} qualified in Wikidata as: ${quals.join(", ")}`);
  }
  const approx = Math.min(start.prec, end.prec) < 9 || [...(sd?.chosen.q ?? []), ...(ed?.chosen.q ?? [])].some((q) => /circa|presumably|disputed|uncertain/i.test(q));
  const ll = parsePoint(d.coord);
  const ex = d.wiki ? extracts[d.wiki] : null;
  const ev = {
    id: c.id, t: d.label, d: d.desc ?? "", c: "faith", cs: [], s: +start.y.toFixed(3), e: +Math.max(end.y, start.y).toFixed(3), p: Math.min(start.prec, end.prec),
    ll, lsrc: ll ? d.coordSrc : null, r: regionOf(ll?.[0], ll?.[1]), w: d.wiki ?? null, x: ex?.text ?? null, xr: ex?.revid ?? null, sl: d.sl,
    rel: c.rel, rk: c.founder ? "founder" : c.kind, ...(approx ? { ap: 1 } : {}), ...(notes.length ? { dn: notes } : {}),
    ...(c.kind === "origin" ? { of: { at: d.formedAt, by: d.founders } } : {}),
  };
  events.push(ev); byIdTmp.set(ev.id, ev);
  relStats[c.rel][c.kind === "figure" ? "figure" : c.kind]++;
}
console.log("religion layer:", JSON.stringify(relStats), "undated origins:", relUndated.map((x) => x.label).join(", "));
events.sort((a, b) => a.s - b.s || b.sl - a.sl);
const idx = new Map(events.map((e, i) => [e.id, i]));

// ---- edges ----
// type: cause | part | sequence | involves | shared
const edges = new Map();
const addEdge = (a, b, type, via) => {
  if (a === b || !idx.has(a) || !idx.has(b)) return;
  const k = `${a}>${b}>${type}`;
  const rk = `${b}>${a}>${type}`;
  if (edges.has(k) || (type !== "cause" && edges.has(rk))) return;
  edges.set(k, { s: a, t: b, k: type, ...(via ? { v: via } : {}) });
};
const participants = new Map(); // participant -> [eventIds]
for (const [e, p, o] of relations) {
  switch (p) {
    case "P828": case "P1478": addEdge(o, e, "cause", p); break;
    case "P1542": addEdge(e, o, "cause", p); break;
    case "P361": addEdge(e, o, "part", p); break;
    case "P527": addEdge(o, e, "part", p); break;
    case "P155": case "P1365": addEdge(o, e, "sequence", p); break;
    case "P156": case "P1366": addEdge(e, o, "sequence", p); break;
    case "P793": addEdge(e, o, "involves", p); break;
    case "P710": case "P17":
      if (idx.has(o)) addEdge(e, o, "involves", p);
      if (idx.has(e)) { if (!participants.has(o)) participants.set(o, new Set()); participants.get(o).add(e); }
      break;
  }
}
// shared participant / country: chain each participant's events in time (prev -> next),
// skipping participants that are too generic (> 120 events) to keep links meaningful.
let sharedCount = 0;
for (const [pid, set] of participants) {
  const list = [...set].map((id) => events[idx.get(id)]).filter((ev) => ev.c !== "era").sort((a, b) => a.s - b.s);
  if (list.length < 2 || list.length > 120) continue;
  const label = details[pid]?.label ?? extLabels[pid] ?? pid;
  for (let i = 1; i < list.length; i++) {
    const before = edges.size;
    addEdge(list[i - 1].id, list[i].id, "shared", label);
    if (edges.size > before) sharedCount++;
  }
}
// religion links: P140 religion -> origin item of that religion; P112 founders
const originOf = {};
for (const e of events) if (e.rk === "origin") originOf[e.rel] ??= e.id;
for (const e of events) if (e.rel && e.rk !== "origin" && originOf[e.rel]) addEdge(originOf[e.rel], e.id, "involves", "P140 religion");
for (const [e, p, o] of relations) if (p === "P112") addEdge(e, o, "involves", "P112 founded by");
const edgeList = [...edges.values()];

// ---- countries (Natural Earth 1:110m admin-0, public domain) ----
function insideRing(lon, lat, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const ne = read("ne_110m_countries.geojson");
const countries = ne.features.map((f) => {
  const g = f.geometry; const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return { id: f.properties.ADM0_A3, name: f.properties.NAME, wd: f.properties.WIKIDATAID, lab: [+f.properties.LABEL_Y.toFixed(2), +f.properties.LABEL_X.toFixed(2)], rings: polys.map((p) => p[0]),
    bbox: polys.flat(2).reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [180, 90, -180, -90]) };
});
const countryByWd = new Map(countries.filter((c) => c.wd).map((c) => [c.wd, c]));
function countryAt(lat, lon) {
  for (const c of countries) {
    if (lon < c.bbox[0] || lon > c.bbox[2] || lat < c.bbox[1] || lat > c.bbox[3]) continue;
    if (c.rings.some((r) => insideRing(lon, lat, r))) return c.id;
  }
  // coastal / small places outside the coarse 1:110m outlines: nearest border vertex within ~3 degrees
  let best = null, bd = 1e9;
  const k = Math.cos((lat * Math.PI) / 180);
  for (const c of countries) {
    if (lon < c.bbox[0] - 4 || lon > c.bbox[2] + 4 || lat < c.bbox[1] - 4 || lat > c.bbox[3] + 4) continue;
    for (const r of c.rings) for (const [x, y] of r) { const d = Math.hypot(y - lat, (x - lon) * k); if (d < bd) { bd = d; best = c; } }
  }
  return bd < 3 ? best.id : null;
}
// continents, oceans and macro-regions are not countries: never map them to one
const MACRO = new Set(["Q15", "Q46", "Q48", "Q18", "Q49", "Q538", "Q51", "Q55643", "Q97", "Q98", "Q1239", "Q7204", "Q48214", "Q27611", "Q664609", "Q11708", "Q771405", "Q27231", "Q5401", "Q27496", "Q4412", "Q27407", "Q27381", "Q27394", "Q12585", "Q828", "Q2", "Q3960", "Q4918", "Q27468", "Q7183", "Q27449", "Q263686", "Q166131", "Q1078", "Q132959", "Q39731"]);
const isMacro = (q, label) => MACRO.has(q) || /\b(Ocean|Sea|Gulf)$|^(Europe|Asia|Africa|Americas|Oceania|Middle East|Near East|Far East)$/i.test(label ?? "");
for (const e of events) {
  // events recorded at many continent-scale places (e.g. World War I) get no single "origin" country
  const pts = e.ml && e.ml.length > 4 ? [] : (e.ml ?? (e.ll ? [e.ll] : []));
  const cc = [...new Set(pts.map((p) => countryAt(p[0], p[1])).filter(Boolean))];
  if (cc.length) e.cc = cc;
}

// ---- impact ripple: recorded Wikidata evidence per event ----
// P710 participant, P17 country, P1542 has effect (+ reverse P1344 "participant in"). Places of linked entities
// come from their own coordinates / capital / location / country / citizenship (fetch-extra.mjs).
const places = optRead("linked-places.json", {});
const reverse = optRead("participant-in.json", []);
const evById = new Map(events.map((e) => [e.id, e]));
const rippleRec = new Map();
const pushRec = (eid, o, prop) => {
  const ev = evById.get(eid); if (!ev) return;
  let cc = null, lab = null, via = null;
  if (countryByWd.has(o)) { cc = countryByWd.get(o).id; via = "country item"; lab = countryByWd.get(o).name; }
  const inSet = evById.get(o);
  if (isMacro(o, places[o]?.label ?? extLabels[o])) return;
  if (!cc && inSet?.cc) { cc = inSet.cc[0]; via = inSet.lsrc ?? "event"; }
  if (!cc && places[o]?.coord) { const pt = parsePoint(places[o].coord); if (pt) { cc = countryAt(pt[0], pt[1]); via = places[o].via; } }
  if (!cc) return;
  lab = inSet?.t ?? details[o]?.label ?? places[o]?.label ?? extLabels[o] ?? lab ?? o;
  const list = rippleRec.get(eid) ?? [];
  if (list.length >= 40 || list.some((x) => x.q === o && x.p === prop)) return;
  if (prop === "P1344" && list.filter((x) => x.p === "P1344").length >= 12) return;
  list.push({ q: o, n: lab, p: prop, cc, via }); rippleRec.set(eid, list);
};
for (const [e, p, o] of relations) if (p === "P710" || p === "P17" || p === "P1542") pushRec(e, o, p);
for (const [x, e] of reverse) pushRec(e, x, "P1344");
for (const [id, list] of rippleRec) evById.get(id).rp = list;

// ---- sources: Wikidata reference URLs (P854) and described-at URLs (P973) ----
const refs = { ...optRead("references.json", {}), ...optRead("religion-references.json", {}) };
for (const e of events) if (refs[e.id]?.length) e.src = refs[e.id];

const countriesOut = { type: "FeatureCollection", features: ne.features.map((f) => ({ type: "Feature", properties: { id: f.properties.ADM0_A3, name: f.properties.NAME }, geometry: f.geometry })) };
const countryMeta = Object.fromEntries(countries.map((c) => [c.id, { n: c.name, lab: c.lab, r: regionOf(c.lab[0], c.lab[1]), wd: c.wd }]));

// ---- patterns ----
const century = (y) => Math.floor(y / 100);
const pctl = (arr, q) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.floor((s.length - 1) * q)]; };
const patterns = [];
for (const c of CATEGORIES) {
  if (c.id === "era") continue;
  const evs = events.filter((e) => e.c === c.id || e.cs.includes(c.id));
  if (evs.length < 3) continue;
  // for empires/dynasties the recurring event is the FALL (end date); for others the start
  const key = c.span ? (e) => e.e : (e) => e.s;
  const sorted = [...evs].filter((e) => !c.span || e.e !== e.s).sort((a, b) => key(a) - key(b));
  const times = sorted.map(key);
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  const byCentury = {};
  for (const t of times) byCentury[century(t)] = (byCentury[century(t)] ?? 0) + 1;
  const busiest = Object.entries(byCentury).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => ({ century: +k, n: v }));
  // "echoes": the 10 best-known events of this type, in time order, with the gap to the previous one
  // skip sub-events (part of another event of the same type, e.g. "COVID-19 pandemic in Italy")
  const ids = new Set(evs.map((e) => e.id));
  const isSub = (e) => edgeList.some((x) => x.k === "part" && x.s === e.id && ids.has(x.t));
  const famous = [...sorted].sort((a, b) => b.sl - a.sl).filter((e) => !isSub(e)).slice(0, 10).sort((a, b) => key(a) - key(b));
  const echoes = famous.map((e, i) => ({ id: e.id, at: +key(e).toFixed(2), gap: i ? +(key(e) - key(famous[i - 1])).toFixed(1) : null }));
  // gaps over the last 500 years (denser, better recorded)
  const recent = times.filter((t) => t >= 1526);
  const recentGaps = recent.slice(1).map((t, i) => t - recent[i]);
  patterns.push({
    id: c.id, label: c.label, color: c.color, measure: c.span ? "fall (end date)" : "start date",
    n: times.length, first: times[0], last: times[times.length - 1],
    medianGap: pctl(gaps, 0.5), p25Gap: pctl(gaps, 0.25), p75Gap: pctl(gaps, 0.75),
    medianGapLast500: pctl(recentGaps, 0.5), nLast500: recent.length,
    busiest, byCentury, echoes,
  });
}
// religions: events per century and per religion
const relPatterns = RELIGIONS.map((r) => {
  const evs = events.filter((e) => e.rel === r.id);
  const byCentury = {};
  for (const e of evs) byCentury[century(e.s)] = (byCentury[century(e.s)] ?? 0) + 1;
  return { id: r.id, label: r.label, color: r.color, n: evs.length, byCentury };
});
// concurrency: how many events (any type) were active per century
const concurrency = {};
for (const e of events) {
  if (e.c === "era") continue;
  for (let cc = century(e.s); cc <= century(e.e); cc++) concurrency[cc] = (concurrency[cc] ?? 0) + 1;
}

// ---- land dots for decorative mini-globe/landing visuals (Natural Earth 110m land, public domain) ----
const land = JSON.parse(fs.readFileSync(path.join(RAW, "ne_110m_land.geojson"), "utf8"));
const polys = [];
for (const f of land.features) {
  const g = f.geometry;
  const ps = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const p of ps) polys.push(p[0]);
}
const inside = (lon, lat, ring) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const dots = [];
for (let lat = -58; lat <= 78; lat += 2) for (let lon = -180; lon < 180; lon += 2) if (polys.some((r) => inside(lon, lat, r))) dots.push([lat, lon]);

// ---- write ----
const catsOut = [...CATEGORIES, { id: "faith", label: "Religions: origins, figures, texts", color: "#e2b0ff" }].map(({ id, label, color, span }) => ({ id, label, color, span: !!span, n: events.filter((e) => e.c === id).length }));
const meta = {
  generatedAt: new Date().toISOString(), fetchedAt,
  counts: { events: events.length, rippleEvents: rippleRec.size, withRefs: events.filter((e) => e.src).length, withCountry: events.filter((e) => e.cc).length, faith: events.filter((e) => e.c === "faith").length, edges: edgeList.length, withCoords: events.filter((e) => e.ll).length, withExtract: events.filter((e) => e.x).length, sharedEdges: sharedCount, ...stats },
  edgeTypes: Object.fromEntries(["cause", "part", "sequence", "involves", "shared"].map((k) => [k, edgeList.filter((e) => e.k === k).length])),
  span: { first: events[0].s, last: Math.max(...events.map((e) => e.e)) },
  categories: catsOut, regions: REGIONS,
  sources: [
    { name: "Wikidata", url: "https://www.wikidata.org", licence: "CC0 1.0", use: "event items, dates, coordinates, classes, relations" },
    { name: "Wikipedia (English)", url: "https://en.wikipedia.org", licence: "CC BY-SA 4.0", use: "intro extracts (first 3 sentences)" },
    { name: "Natural Earth", url: "https://www.naturalearthdata.com", licence: "Public domain", use: "land outline, country polygons and centroids (impact ripple)" },
  ],
};
fs.writeFileSync(path.join(OUT, "events.json"), JSON.stringify(events));
fs.writeFileSync(path.join(OUT, "edges.json"), JSON.stringify(edgeList));
fs.writeFileSync(path.join(OUT, "patterns.json"), JSON.stringify({ patterns, concurrency, religions: relPatterns }));
fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify(meta, null, 1));
fs.writeFileSync(path.join(OUT, "land-dots.json"), JSON.stringify(dots));
fs.writeFileSync(path.join(OUT, "countries.geojson"), JSON.stringify(countriesOut));
fs.writeFileSync(path.join(OUT, "countries-meta.json"), JSON.stringify(countryMeta));
fs.writeFileSync(path.join(OUT, "religions.json"), JSON.stringify({ religions: RELIGIONS.map(({ id, label, color, roots }) => ({ id, label, color, roots })), texts: TEXTS, skipped: SKIPPED, stats: relStats, undated: relUndated }));
console.log(JSON.stringify(meta.counts), meta.edgeTypes, meta.span, "land dots", dots.length);
for (const c of catsOut) console.log(c.id.padEnd(14), c.n);
