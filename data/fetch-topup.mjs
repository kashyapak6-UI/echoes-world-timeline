// Incremental top-up: fetch details, relations, labels, extracts, reverse P1344, linked places and references
// for candidate ids that are not yet in the cache (e.g. after adding a category). Run after fetch.mjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "./categories.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(DIR, "raw");
const UA = "WorldTimelineDemo/0.1 (open-data history timeline prototype; contact via project repo)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const qid = (uri) => uri.slice(uri.lastIndexOf("/") + 1);
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const rd = (n, d) => (fs.existsSync(path.join(RAW, n)) ? JSON.parse(fs.readFileSync(path.join(RAW, n), "utf8")) : d);
const wr = (n, v) => fs.writeFileSync(path.join(RAW, n), JSON.stringify(v));
async function sparql(query) {
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch("https://query.wikidata.org/sparql", { method: "POST", headers: { "User-Agent": UA, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ query }) });
      if (res.status === 429) { await sleep(10000 * (i + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()).results.bindings;
    } catch (e) { console.warn("retry", e.message); await sleep(4000 * (i + 1)); }
  }
  throw new Error("SPARQL failed");
}

const details = rd("details.json", {});
const allIds = [...new Set(CATEGORIES.flatMap((c) => rd(`ids-${c.id}.json`, []).map((r) => r.id)))];
const missing = allIds.filter((id) => !details[id]);
console.log(`top-up: ${missing.length} new candidate items`);
if (!missing.length) process.exit(0);

const DETAIL_PROPS = ["P585", "P580", "P582", "P571", "P576", "P575"];
for (const b of chunk(missing, 120)) {
  const dateSel = DETAIL_PROPS.map((p) => `(MIN(?${p}v) AS ?${p}) (MIN(?${p}p) AS ?${p}prec)`).join(" ");
  const dateOpt = DETAIL_PROPS.map((p) => `OPTIONAL { ?e p:${p} ?${p}s . ?${p}s psv:${p} [ wikibase:timeValue ?${p}v ; wikibase:timePrecision ?${p}p ] . }`).join("\n");
  const q = `SELECT ?e (SAMPLE(?lbl) AS ?label) (SAMPLE(?dsc) AS ?desc) (SAMPLE(?sl0) AS ?sl) ${dateSel}
    (SAMPLE(?c1) AS ?coord) (SAMPLE(?c2) AS ?locCoord) (GROUP_CONCAT(DISTINCT STR(?c2); separator="|") AS ?locCoords) (SAMPLE(?c3) AS ?countryCoord) (SAMPLE(?c4) AS ?capCoord)
    (SAMPLE(?title) AS ?wiki) (GROUP_CONCAT(DISTINCT ?cont; separator="|") AS ?continents) (GROUP_CONCAT(DISTINCT ?inst; separator="|") AS ?p31)
  WHERE { VALUES ?e { ${b.map((x) => `wd:${x}`).join(" ")} } ?e wikibase:sitelinks ?sl0 .
    OPTIONAL { ?e rdfs:label ?lbl FILTER(LANG(?lbl)="en") } OPTIONAL { ?e schema:description ?dsc FILTER(LANG(?dsc)="en") }
    ${dateOpt}
    OPTIONAL { ?e wdt:P625 ?c1 } OPTIONAL { ?e wdt:P276/wdt:P625 ?c2 } OPTIONAL { ?e wdt:P17/wdt:P625 ?c3 } OPTIONAL { ?e wdt:P36/wdt:P625 ?c4 }
    OPTIONAL { ?e wdt:P30 ?cont } OPTIONAL { ?e wdt:P31 ?inst }
    OPTIONAL { ?art schema:about ?e ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title } } GROUP BY ?e`;
  for (const r of await sparql(q)) {
    const g = (k) => r[k]?.value;
    const o = { label: g("label"), desc: g("desc"), sl: +(g("sl") ?? 0), wiki: g("wiki"),
      coord: g("coord") ?? g("locCoord") ?? g("capCoord") ?? g("countryCoord"),
      coordSrc: g("coord") ? "P625" : g("locCoord") ? "P276" : g("capCoord") ? "P36" : g("countryCoord") ? "P17" : null,
      locCoords: g("locCoords") ? g("locCoords").split("|").slice(0, 12) : [],
      continents: g("continents") ? g("continents").split("|").map(qid) : [], p31: g("p31") ? g("p31").split("|").map(qid) : [] };
    for (const p of DETAIL_PROPS) if (g(p)) o[p] = { v: g(p), prec: +g(`${p}prec`) };
    details[qid(r.e.value)] = o;
  }
  await sleep(800);
}
wr("details.json", details);

const relations = rd("relations.json", []);
const REL_PROPS = ["P828", "P1542", "P1478", "P361", "P527", "P155", "P156", "P1365", "P1366", "P793", "P710", "P17"];
const newRel = [];
for (const b of chunk(missing, 150)) {
  const q = `SELECT ?e ?p ?o WHERE { VALUES ?e { ${b.map((x) => `wd:${x}`).join(" ")} } VALUES ?p { ${REL_PROPS.map((p) => `wdt:${p}`).join(" ")} } ?e ?p ?o . FILTER(ISIRI(?o) && STRSTARTS(STR(?o), "http://www.wikidata.org/entity/Q")) }`;
  for (const r of await sparql(q)) newRel.push([qid(r.e.value), qid(r.p.value), qid(r.o.value)]);
  await sleep(800);
}
wr("relations.json", relations.concat(newRel));

const labels = rd("external-labels.json", {});
const ext = [...new Set(newRel.filter(([, p, o]) => (p === "P710" || p === "P17") && !details[o] && !labels[o]).map(([, , o]) => o))];
for (const b of chunk(ext, 300)) {
  for (const r of await sparql(`SELECT ?e ?l WHERE { VALUES ?e { ${b.map((x) => `wd:${x}`).join(" ")} } ?e rdfs:label ?l FILTER(LANG(?l)="en") }`)) labels[qid(r.e.value)] = r.l.value;
}
wr("external-labels.json", labels);

const extracts = rd("wikipedia-extracts.json", {});
const titles = missing.map((id) => details[id]?.wiki).filter((t) => t && !extracts[t]);
for (const b of chunk(titles, 20)) {
  const u = new URL("https://en.wikipedia.org/w/api.php");
  u.search = new URLSearchParams({ action: "query", prop: "extracts|revisions", rvprop: "ids", exintro: "1", explaintext: "1", exsentences: "3", redirects: "1", titles: b.join("|"), format: "json", formatversion: "2" });
  let j = null;
  for (let i = 0; i < 6 && !j; i++) { try { const res = await fetch(u, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) }); if (!res.ok) { await sleep(8000 * (i + 1)); continue; } j = await res.json(); } catch { await sleep(5000); } }
  const norm = {};
  for (const x of [...(j?.query?.normalized ?? []), ...(j?.query?.redirects ?? [])]) norm[x.to] = x.from;
  for (const p of j?.query?.pages ?? []) { if (!p.extract) continue; let key = p.title; while (norm[key]) key = norm[key]; extracts[key] = { text: p.extract.trim(), revid: p.revisions?.[0]?.revid ?? null }; }
  await sleep(600);
}
wr("wikipedia-extracts.json", extracts);

const reverse = rd("participant-in.json", []);
const newRev = [];
for (const b of chunk(missing, 200)) {
  for (const r of await sparql(`SELECT ?x ?e WHERE { VALUES ?e { ${b.map((x) => `wd:${x}`).join(" ")} } ?x wdt:P1344 ?e . }`)) newRev.push([qid(r.x.value), qid(r.e.value)]);
}
wr("participant-in.json", reverse.concat(newRev));

const places = rd("linked-places.json", {});
const linked = [...new Set([...newRel.filter(([, p]) => ["P710", "P17", "P1542", "P828", "P1478", "P361"].includes(p)).map(([, , o]) => o), ...newRev.map(([x]) => x)])].filter((x) => !(x in places));
for (const b of chunk(linked, 250)) {
  const q = `SELECT ?x (SAMPLE(?l) AS ?label) (SAMPLE(?c1) AS ?own) (SAMPLE(?c2) AS ?cap) (SAMPLE(?c3) AS ?country) (SAMPLE(?c4) AS ?citizen) (SAMPLE(?c5) AS ?loc) WHERE {
    VALUES ?x { ${b.map((x) => `wd:${x}`).join(" ")} } OPTIONAL { ?x rdfs:label ?l FILTER(LANG(?l)="en") }
    OPTIONAL { ?x wdt:P625 ?c1 } OPTIONAL { ?x wdt:P36/wdt:P625 ?c2 } OPTIONAL { ?x wdt:P17/wdt:P625 ?c3 } OPTIONAL { ?x wdt:P27/wdt:P625 ?c4 } OPTIONAL { ?x wdt:P276/wdt:P625 ?c5 } } GROUP BY ?x`;
  for (const r of await sparql(q)) {
    const g = (k) => r[k]?.value;
    const pick = g("cap") ? ["P36", g("cap")] : g("own") ? ["P625", g("own")] : g("loc") ? ["P276", g("loc")] : g("country") ? ["P17", g("country")] : g("citizen") ? ["P27", g("citizen")] : null;
    places[qid(r.x.value)] = { label: g("label") ?? null, coord: pick?.[1] ?? null, via: pick?.[0] ?? null };
  }
  await sleep(700);
}
wr("linked-places.json", places);

const refs = rd("references.json", {});
for (const b of chunk(missing, 60)) {
  const q = `SELECT ?e ?url ?kind WHERE { VALUES ?e { ${b.map((x) => `wd:${x}`).join(" ")} }
    { ?e ?p ?st . ?st prov:wasDerivedFrom/pr:P854 ?url . BIND("ref" AS ?kind) } UNION { ?e wdt:P973 ?url . BIND("described" AS ?kind) } }`;
  for (const r of await sparql(q)) {
    const e = qid(r.e.value), url = r.url.value;
    if (!/^https?:\/\//.test(url) || /wikipedia\.org|wikidata\.org/.test(url)) continue;
    (refs[e] ??= []);
    if (refs[e].length < 8 && !refs[e].some((x) => x.url === url)) refs[e].push({ url, kind: r.kind.value });
  }
  await sleep(500);
}
wr("references.json", refs);
console.log(`top-up done: +${missing.length} items, +${newRel.length} relations, +${newRev.length} reverse links, +${linked.length} places`);
