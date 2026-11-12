// Fetch pipeline: Wikidata SPARQL (CC0) + Wikipedia intro extracts (CC BY-SA 4.0).
// Results are cached in data/raw/*.json so re-runs are cheap. Run: node data/fetch.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "./categories.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(DIR, "raw");
fs.mkdirSync(RAW, { recursive: true });
const UA = "WorldTimelineDemo/0.1 (open-data history timeline prototype; contact via project repo)";
const SPARQL = "https://query.wikidata.org/sparql";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(SPARQL, {
        method: "POST",
        headers: { "User-Agent": UA, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ query }),
      });
      if (res.status === 429) { await sleep(10000 * (i + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = await res.json();
      return j.results.bindings;
    } catch (e) {
      console.warn(`  sparql retry ${i + 1}: ${e.message.slice(0, 200)}`);
      await sleep(4000 * (i + 1));
    }
  }
  throw new Error("SPARQL failed after retries");
}
const qid = (uri) => uri.slice(uri.lastIndexOf("/") + 1);
const cached = async (name, fn) => {
  const f = path.join(RAW, name);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  const v = await fn();
  fs.writeFileSync(f, JSON.stringify(v));
  return v;
};
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// 1) candidate IDs per category
const members = {}; // qid -> Set(category)
for (const c of CATEGORIES) {
  const rows = await cached(`ids-${c.id}.json`, async () => {
    const out = [];
    const parts = c.property ? [null] : c.classes;
    for (const cls of parts) {
      const where = c.property
        ? `?e wdt:${c.property} ?_d .`
        : `?e wdt:P31/wdt:P279* wd:${cls} .`;
      const q = `SELECT DISTINCT ?e ?sl WHERE { ${where} ?e wikibase:sitelinks ?sl . FILTER(?sl >= ${c.minSL}) } ORDER BY DESC(?sl) LIMIT ${c.limit * 2}`;
      console.log(`[ids] ${c.id} ${cls ?? c.property}`);
      const b = await sparql(q);
      for (const r of b) out.push({ id: qid(r.e.value), sl: +r.sl.value });
      await sleep(1200);
    }
    return out;
  });
  console.log(`  ${c.id}: ${rows.length} candidates`);
  for (const r of rows) (members[r.id] ??= new Set()).add(c.id);
}
const allIds = Object.keys(members);
console.log(`Total candidate items: ${allIds.length}`);

// 2) details in batches
const DETAIL_PROPS = ["P585", "P580", "P582", "P571", "P576", "P575"];
const details = await cached("details.json", async () => {
  const out = {};
  const batches = chunk(allIds, 120);
  let n = 0;
  for (const b of batches) {
    const values = b.map((x) => `wd:${x}`).join(" ");
    const dateSel = DETAIL_PROPS.map((p) => `(MIN(?${p}v) AS ?${p}) (MIN(?${p}p) AS ?${p}prec)`).join(" ");
    const dateOpt = DETAIL_PROPS.map((p) => `OPTIONAL { ?e p:${p} ?${p}s . ?${p}s psv:${p} [ wikibase:timeValue ?${p}v ; wikibase:timePrecision ?${p}p ] . }`).join("\n");
    const q = `SELECT ?e (SAMPLE(?lbl) AS ?label) (SAMPLE(?dsc) AS ?desc) (SAMPLE(?sl0) AS ?sl) ${dateSel}
      (SAMPLE(?c1) AS ?coord) (SAMPLE(?c2) AS ?locCoord) (GROUP_CONCAT(DISTINCT STR(?c2); separator="|") AS ?locCoords) (SAMPLE(?c3) AS ?countryCoord) (SAMPLE(?c4) AS ?capCoord)
      (SAMPLE(?title) AS ?wiki) (GROUP_CONCAT(DISTINCT ?cont; separator="|") AS ?continents)
      (GROUP_CONCAT(DISTINCT ?inst; separator="|") AS ?p31)
    WHERE {
      VALUES ?e { ${values} }
      ?e wikibase:sitelinks ?sl0 .
      OPTIONAL { ?e rdfs:label ?lbl FILTER(LANG(?lbl)="en") }
      OPTIONAL { ?e schema:description ?dsc FILTER(LANG(?dsc)="en") }
      ${dateOpt}
      OPTIONAL { ?e wdt:P625 ?c1 }
      OPTIONAL { ?e wdt:P276/wdt:P625 ?c2 }
      OPTIONAL { ?e wdt:P17/wdt:P625 ?c3 }
      OPTIONAL { ?e wdt:P36/wdt:P625 ?c4 }
      OPTIONAL { ?e wdt:P30 ?cont }
      OPTIONAL { ?e wdt:P31 ?inst }
      OPTIONAL { ?art schema:about ?e ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title }
    } GROUP BY ?e`;
    const rows = await sparql(q);
    for (const r of rows) {
      const g = (k) => r[k]?.value;
      const o = { label: g("label"), desc: g("desc"), sl: +(g("sl") ?? 0), wiki: g("wiki"),
        coord: g("coord") ?? g("locCoord") ?? g("capCoord") ?? g("countryCoord"),
        coordSrc: g("coord") ? "P625" : g("locCoord") ? "P276" : g("capCoord") ? "P36" : g("countryCoord") ? "P17" : null,
        locCoords: g("locCoords") ? g("locCoords").split("|").slice(0, 12) : [],
        continents: g("continents") ? g("continents").split("|").map(qid) : [],
        p31: g("p31") ? g("p31").split("|").map(qid) : [] };
      for (const p of DETAIL_PROPS) if (g(p)) o[p] = { v: g(p), prec: +g(`${p}prec`) };
      out[qid(r.e.value)] = o;
    }
    n += b.length;
    console.log(`[details] ${n}/${allIds.length}`);
    await sleep(800);
  }
  return out;
});

// 3) relations between items
const REL_PROPS = ["P828", "P1542", "P1478", "P361", "P527", "P155", "P156", "P1365", "P1366", "P793", "P710", "P17"];
const relations = await cached("relations.json", async () => {
  const out = [];
  const batches = chunk(allIds, 150);
  let n = 0;
  for (const b of batches) {
    const values = b.map((x) => `wd:${x}`).join(" ");
    const props = REL_PROPS.map((p) => `wdt:${p}`).join(" ");
    const q = `SELECT ?e ?p ?o WHERE { VALUES ?e { ${values} } VALUES ?p { ${props} } ?e ?p ?o . FILTER(ISIRI(?o) && STRSTARTS(STR(?o), "http://www.wikidata.org/entity/Q")) }`;
    const rows = await sparql(q);
    for (const r of rows) out.push([qid(r.e.value), qid(r.p.value), qid(r.o.value)]);
    n += b.length;
    console.log(`[relations] ${n}/${allIds.length} (${out.length} triples)`);
    await sleep(800);
  }
  return out;
});

// 4) labels for participants / countries that are outside the item set (used for "shared participant" links)
const external = [...new Set(relations.filter(([, p, o]) => (p === "P710" || p === "P17") && !details[o]).map(([, , o]) => o))];
await cached("external-labels.json", async () => {
  const out = {};
  for (const b of chunk(external, 300)) {
    const q = `SELECT ?e ?l WHERE { VALUES ?e { ${b.map((x) => `wd:${x}`).join(" ")} } ?e rdfs:label ?l FILTER(LANG(?l)="en") }`;
    for (const r of await sparql(q)) out[qid(r.e.value)] = r.l.value;
    await sleep(800);
  }
  console.log(`[labels] ${Object.keys(out).length} external labels`);
  return out;
});

// 5) Wikipedia intro extracts (CC BY-SA 4.0) for items with an English article
const titles = [...new Set(Object.values(details).map((d) => d.wiki).filter(Boolean))];
const extracts = await cached("wikipedia-extracts.json", async () => {
  const out = {};
  let n = 0;
  for (const b of chunk(titles, 20)) {
    const u = new URL("https://en.wikipedia.org/w/api.php");
    u.search = new URLSearchParams({ action: "query", prop: "extracts|revisions", rvprop: "ids", exintro: "1", explaintext: "1", exsentences: "3", redirects: "1", titles: b.join("|"), format: "json", formatversion: "2" });
    let j;
    for (let i = 0; i < 4; i++) {
      try { const res = await fetch(u, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) }); if (res.status === 429) { await sleep(5000 * (i + 1)); continue; } j = await res.json(); break; } catch (e) { console.warn(`  wikipedia retry ${i + 1}: ${e.message}`); await sleep(3000); }
    }
    const norm = {};
    for (const x of [...(j?.query?.normalized ?? []), ...(j?.query?.redirects ?? [])]) norm[x.to] = x.from;
    for (const p of j?.query?.pages ?? []) {
      if (!p.extract) continue;
      let key = p.title; while (norm[key]) key = norm[key];
      out[key] = { text: p.extract.trim(), revid: p.revisions?.[0]?.revid ?? null };
    }
    n += b.length;
    if (n % 400 === 0) console.log(`[wikipedia] ${n}/${titles.length} (${Object.keys(out).length} extracts)`);
    await sleep(150);
  }
  return out;
});
console.log(`[wikipedia] extracts: ${Object.keys(extracts).length}/${titles.length}`);
fs.writeFileSync(path.join(RAW, "fetched-at.json"), JSON.stringify({ at: new Date().toISOString() }));
console.log("done");
