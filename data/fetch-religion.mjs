// Religion layer: religions (inception / founder / place of formation), key figures (birth–death),
// scriptures, places of worship, councils, orders and other dated events linked to each religion (P140).
// All dates come from Wikidata, including every alternative value and its qualifiers (circa, disputed…).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RELIGIONS, CLASS_TO_RELIGION } from "./religions.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(DIR, "raw");
const UA = "WorldTimelineDemo/0.1 (open-data history timeline prototype)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const qid = (uri) => uri.slice(uri.lastIndexOf("/") + 1);
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
async function sparql(query, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch("https://query.wikidata.org/sparql", {
        method: "POST", signal: AbortSignal.timeout(70000),
        headers: { "User-Agent": UA, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ query }),
      });
      if (res.status === 429) { await sleep(10000 * (i + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 150)}`);
      return (await res.json()).results.bindings;
    } catch (e) { console.warn(`  retry ${i + 1}: ${e.message}`); await sleep(4000 * (i + 1)); }
  }
  throw new Error("SPARQL failed");
}
const cached = async (name, fn) => {
  const f = path.join(RAW, name);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  const v = await fn(); fs.writeFileSync(f, JSON.stringify(v)); return v;
};

// 1) candidates per religion: kind = figure | scripture | site | event, plus founders
const LIMITS = { figure: 45, scripture: 25, site: 25, event: 45 };
async function subclassSet(classes, root) {
  const out = new Set();
  for (const b of chunk([...classes], 300)) {
    const rows = await sparql(`SELECT DISTINCT ?c WHERE { VALUES ?c { ${b.map((x) => `wd:${x}`).join(" ")} } ?c wdt:P279* wd:${root} . }`);
    for (const r of rows) out.add(qid(r.c.value));
    await sleep(500);
  }
  return out;
}
const cands = await cached("religion-candidates.json", async () => {
  const raw = {};
  for (const r of RELIGIONS) {
    const roots = r.roots.map((x) => `wd:${x}`).join(" ");
    const q = `SELECT ?x (SAMPLE(?sl0) AS ?sl) (GROUP_CONCAT(DISTINCT ?i; separator="|") AS ?p31) (GROUP_CONCAT(DISTINCT ?o; separator="|") AS ?p106) WHERE {
      { SELECT DISTINCT ?x ?sl0 WHERE { VALUES ?root { ${roots} } ?x wdt:P140/wdt:P279* ?root ; wikibase:sitelinks ?sl0 . FILTER(?sl0 >= 10) } ORDER BY DESC(?sl0) LIMIT 1500 }
      OPTIONAL { ?x wdt:P31 ?i } OPTIONAL { ?x wdt:P106 ?o } } GROUP BY ?x`;
    raw[r.id] = (await sparql(q)).map((b) => ({ id: qid(b.x.value), sl: +b.sl.value, p31: b.p31.value ? b.p31.value.split("|").map(qid) : [], p106: b.p106.value ? b.p106.value.split("|").map(qid) : [] }));
    console.log(`[religion] ${r.id}: ${raw[r.id].length} items`);
    await sleep(1200);
  }
  const all = Object.values(raw).flat();
  const textC = await subclassSet(new Set(all.flatMap((x) => x.p31)), "Q179461");
  const siteC = await subclassSet(new Set(all.flatMap((x) => x.p31)), "Q1370598");
  const roleC = await subclassSet(new Set(all.flatMap((x) => x.p106)), "Q4504549");
  const out = [];
  for (const r of RELIGIONS) {
    const count = { figure: 0, scripture: 0, site: 0, event: 0 };
    for (const x of raw[r.id].sort((a, b) => b.sl - a.sl)) {
      const human = x.p31.includes("Q5");
      const kind = human ? (x.p106.some((o) => roleC.has(o)) && x.sl >= 35 ? "figure" : null)
        : x.p31.some((c) => textC.has(c)) ? "scripture" : x.p31.some((c) => siteC.has(c)) ? (x.sl >= 40 ? "site" : null) : "event";
      if (!kind || count[kind] >= LIMITS[kind]) continue;
      count[kind]++;
      out.push({ id: x.id, rel: r.id, kind, sl: x.sl });
    }
    console.log(`  ${r.id}`, JSON.stringify(count));
  }
  for (const r of RELIGIONS) {
    // founders (P112) of the religion itself are always figures
    const fq = `SELECT ?f WHERE { VALUES ?root { ${r.roots.map((x) => `wd:${x}`).join(" ")} } ?root wdt:P112 ?f . ?f wdt:P31 wd:Q5 . }`;
    for (const b of await sparql(fq)) out.push({ id: qid(b.f.value), rel: r.id, kind: "figure", founder: true, sl: 999 });
    for (const root of r.roots) out.push({ id: root, rel: r.id, kind: "origin", sl: 1000 });
    await sleep(900);
  }
  for (const [cls, rel] of Object.entries(CLASS_TO_RELIGION)) {
    const rows = await sparql(`SELECT DISTINCT ?x ?sl WHERE { ?x wdt:P31/wdt:P279* wd:${cls} ; wikibase:sitelinks ?sl . FILTER(?sl >= 8) } ORDER BY DESC(?sl) LIMIT 40`);
    for (const b of rows) out.push({ id: qid(b.x.value), rel, kind: "event", sl: +b.sl.value });
    console.log(`[religion] class ${cls}: ${rows.length}`);
  }
  return out;
});

// 2) details incl. every date value with precision + qualifiers (P1480 sourcing circumstances)
const ids = [...new Set(cands.map((c) => c.id))];
const DATE_PROPS = ["P569", "P570", "P571", "P580", "P582", "P585", "P577", "P576"];
const rdetails = await cached("religion-details.json", async () => {
  const out = {};
  for (const b of chunk(ids, 80)) {
    const values = b.map((x) => `wd:${x}`).join(" ");
    const base = `SELECT ?x (SAMPLE(?l) AS ?label) (SAMPLE(?d) AS ?desc) (SAMPLE(?sl0) AS ?sl) (SAMPLE(?t) AS ?wiki)
      (SAMPLE(?c1) AS ?own) (SAMPLE(?c2) AS ?formed) (SAMPLE(?c3) AS ?born) (SAMPLE(?c4) AS ?loc) (SAMPLE(?c5) AS ?admin) (SAMPLE(?c6) AS ?country)
      (SAMPLE(?flab) AS ?formedLabel) (GROUP_CONCAT(DISTINCT ?fl; separator="|") AS ?founders) (GROUP_CONCAT(DISTINCT ?p31; separator="|") AS ?p31s)
      WHERE { VALUES ?x { ${values} } ?x wikibase:sitelinks ?sl0 .
      OPTIONAL { ?x rdfs:label ?l FILTER(LANG(?l)="en") } OPTIONAL { ?x schema:description ?d FILTER(LANG(?d)="en") }
      OPTIONAL { ?a schema:about ?x ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?t }
      OPTIONAL { ?x wdt:P625 ?c1 } OPTIONAL { ?x wdt:P740 ?fp . ?fp wdt:P625 ?c2 . OPTIONAL { ?fp rdfs:label ?flab FILTER(LANG(?flab)="en") } }
      OPTIONAL { ?x wdt:P19/wdt:P625 ?c3 } OPTIONAL { ?x wdt:P276/wdt:P625 ?c4 } OPTIONAL { ?x wdt:P131/wdt:P625 ?c5 } OPTIONAL { ?x wdt:P17/wdt:P625 ?c6 }
      OPTIONAL { ?x wdt:P112 ?f . ?f rdfs:label ?fl FILTER(LANG(?fl)="en") }
      OPTIONAL { ?x wdt:P31 ?p31 }
      } GROUP BY ?x`;
    for (const r of await sparql(base)) {
      const g = (k) => r[k]?.value;
      const pick = [["P625", g("own")], ["P740", g("formed")], ["P19", g("born")], ["P276", g("loc")], ["P131", g("admin")], ["P17", g("country")]].find(([, v]) => v);
      out[qid(r.x.value)] = { label: g("label"), desc: g("desc"), sl: +g("sl"), wiki: g("wiki"), coord: pick?.[1] ?? null, coordSrc: pick?.[0] ?? null,
        formedAt: g("formedLabel") ?? null, founders: g("founders") ? g("founders").split("|") : [], p31: g("p31s") ? g("p31s").split("|").map(qid) : [], dates: {} };
    }
    const dq = `SELECT ?x ?p ?v ?prec ?rank (GROUP_CONCAT(DISTINCT ?ql; separator="|") AS ?quals) WHERE {
      VALUES ?x { ${values} } VALUES ?p { ${DATE_PROPS.map((p) => `p:${p}`).join(" ")} }
      ?x ?p ?st . ?st wikibase:rank ?rank . FILTER(?rank != wikibase:DeprecatedRank)
      ?st ?psv ?node . ?node wikibase:timeValue ?v ; wikibase:timePrecision ?prec . FILTER(STRSTARTS(STR(?psv), "http://www.wikidata.org/prop/statement/value/"))
      OPTIONAL { ?st pq:P1480 ?q . ?q rdfs:label ?ql FILTER(LANG(?ql)="en") }
    } GROUP BY ?x ?p ?v ?prec ?rank`;
    for (const r of await sparql(dq)) {
      const d = out[qid(r.x.value)]; if (!d) continue;
      const p = qid(r.p.value);
      (d.dates[p] ??= []).push({ v: r.v.value, prec: +r.prec.value, pref: r.rank.value.endsWith("PreferredRank"), q: r.quals.value ? r.quals.value.split("|") : [] });
    }
    console.log(`[religion details] +${b.length}`);
    await sleep(900);
  }
  return out;
});

// 3) Wikipedia extracts for religion items not already cached
const exFile = path.join(RAW, "wikipedia-extracts.json");
const extracts = JSON.parse(fs.readFileSync(exFile, "utf8"));
const missing = [...new Set(Object.values(rdetails).map((d) => d.wiki).filter((t) => t && !extracts[t]))];
for (const b of chunk(missing, 20)) {
  const u = new URL("https://en.wikipedia.org/w/api.php");
  u.search = new URLSearchParams({ action: "query", prop: "extracts|revisions", rvprop: "ids", exintro: "1", explaintext: "1", exsentences: "3", redirects: "1", titles: b.join("|"), format: "json", formatversion: "2" });
  let j = null;
  for (let i = 0; i < 6 && !j; i++) {
    try { const res = await fetch(u, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) }); if (res.status === 429 || !res.ok) { await sleep(8000 * (i + 1)); continue; } j = await res.json(); }
    catch { await sleep(5000); }
  }
  const norm = {};
  for (const x of [...(j?.query?.normalized ?? []), ...(j?.query?.redirects ?? [])]) norm[x.to] = x.from;
  for (const p of j?.query?.pages ?? []) { if (!p.extract) continue; let k = p.title; while (norm[k]) k = norm[k]; extracts[k] = { text: p.extract.trim(), revid: p.revisions?.[0]?.revid ?? null }; }
  await sleep(600);
}
fs.writeFileSync(exFile, JSON.stringify(extracts));
console.log(`done: ${cands.length} candidate rows, ${Object.keys(rdetails).length} items, ${missing.length} new extracts`);

// 4) relations + reference URLs for the religion items (same props as the main pipeline)
const REL_PROPS = ["P828", "P1542", "P1478", "P361", "P527", "P155", "P156", "P1365", "P1366", "P793", "P710", "P17", "P112"];
const relIds = Object.keys(rdetails);
await cached("religion-relations.json", async () => {
  const out = [];
  for (const b of chunk(relIds, 150)) {
    const q = `SELECT ?e ?p ?o WHERE { VALUES ?e { ${b.map((x) => `wd:${x}`).join(" ")} } VALUES ?p { ${REL_PROPS.map((p) => `wdt:${p}`).join(" ")} } ?e ?p ?o . FILTER(ISIRI(?o) && STRSTARTS(STR(?o), "http://www.wikidata.org/entity/Q")) }`;
    for (const r of await sparql(q)) out.push([qid(r.e.value), qid(r.p.value), qid(r.o.value)]);
    await sleep(700);
  }
  console.log(`[religion relations] ${out.length}`);
  return out;
});
await cached("religion-references.json", async () => {
  const out = {};
  for (const b of chunk(relIds, 60)) {
    const q = `SELECT ?e ?url ?kind WHERE { VALUES ?e { ${b.map((x) => `wd:${x}`).join(" ")} }
      { ?e ?p ?st . ?st prov:wasDerivedFrom/pr:P854 ?url . BIND("ref" AS ?kind) } UNION { ?e wdt:P973 ?url . BIND("described" AS ?kind) } }`;
    for (const r of await sparql(q)) {
      const e = qid(r.e.value), url = r.url.value;
      if (!/^https?:\/\//.test(url) || /wikipedia\.org|wikidata\.org/.test(url)) continue;
      (out[e] ??= []);
      if (out[e].length < 8 && !out[e].some((x) => x.url === url)) out[e].push({ url, kind: r.kind.value });
    }
    await sleep(500);
  }
  return out;
});
console.log("religion extras done");
