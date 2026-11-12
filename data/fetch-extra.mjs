// Extra Wikidata fetches for (1) the impact-ripple layer and (2) per-event source references.
// Run after fetch.mjs: node data/fetch-extra.mjs   (cached in data/raw/)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
const details = JSON.parse(fs.readFileSync(path.join(RAW, "details.json"), "utf8"));
const relations = JSON.parse(fs.readFileSync(path.join(RAW, "relations.json"), "utf8"));
const ids = Object.keys(details);

// 1) reverse "participant in" (P1344): who recorded themselves as taking part in each event
const reverse = await cached("participant-in.json", async () => {
  const out = [];
  for (const b of chunk(ids, 200)) {
    const q = `SELECT ?x ?e WHERE { VALUES ?e { ${b.map((x) => `wd:${x}`).join(" ")} } ?x wdt:P1344 ?e . }`;
    for (const r of await sparql(q)) out.push([qid(r.x.value), qid(r.e.value)]);
    await sleep(700);
  }
  console.log(`[P1344] ${out.length} reverse participant links`);
  return out;
});

// 2) where are the participants / countries / effects? coordinates of every linked entity
const linked = new Set();
for (const [, p, o] of relations) if (["P710", "P17", "P1542", "P828", "P1478", "P361"].includes(p)) linked.add(o);
for (const [x] of reverse) linked.add(x);
const linkedIds = [...linked];
const places = await cached("linked-places.json", async () => {
  const out = {};
  let n = 0;
  for (const b of chunk(linkedIds, 250)) {
    const q = `SELECT ?x (SAMPLE(?l) AS ?label) (SAMPLE(?c1) AS ?own) (SAMPLE(?c2) AS ?cap) (SAMPLE(?c3) AS ?country) (SAMPLE(?c4) AS ?citizen) (SAMPLE(?c5) AS ?loc) WHERE {
      VALUES ?x { ${b.map((x) => `wd:${x}`).join(" ")} }
      OPTIONAL { ?x rdfs:label ?l FILTER(LANG(?l)="en") }
      OPTIONAL { ?x wdt:P625 ?c1 } OPTIONAL { ?x wdt:P36/wdt:P625 ?c2 } OPTIONAL { ?x wdt:P17/wdt:P625 ?c3 }
      OPTIONAL { ?x wdt:P27/wdt:P625 ?c4 } OPTIONAL { ?x wdt:P276/wdt:P625 ?c5 }
    } GROUP BY ?x`;
    for (const r of await sparql(q)) {
      const g = (k) => r[k]?.value;
      const pick = g("cap") ? ["P36", g("cap")] : g("own") ? ["P625", g("own")] : g("loc") ? ["P276", g("loc")] : g("country") ? ["P17", g("country")] : g("citizen") ? ["P27", g("citizen")] : null;
      out[qid(r.x.value)] = { label: g("label") ?? null, coord: pick?.[1] ?? null, via: pick?.[0] ?? null };
    }
    n += b.length; console.log(`[places] ${n}/${linkedIds.length}`);
    await sleep(700);
  }
  return out;
});

// 3) sources: reference URLs (P854) on the item's statements + "described at URL" (P973)
const refs = await cached("references.json", async () => {
  const out = {};
  let n = 0;
  for (const b of chunk(ids, 60)) {
    const values = b.map((x) => `wd:${x}`).join(" ");
    const q = `SELECT ?e ?url ?kind WHERE { VALUES ?e { ${values} }
      { ?e ?p ?st . ?st prov:wasDerivedFrom/pr:P854 ?url . BIND("ref" AS ?kind) }
      UNION { ?e wdt:P973 ?url . BIND("described" AS ?kind) } }`;
    for (const r of await sparql(q)) {
      const e = qid(r.e.value), url = r.url.value;
      if (!/^https?:\/\//.test(url) || /wikipedia\.org|wikidata\.org/.test(url)) continue;
      (out[e] ??= []);
      if (out[e].length < 8 && !out[e].some((x) => x.url === url)) out[e].push({ url, kind: r.kind.value });
    }
    n += b.length; if (n % 600 === 0) console.log(`[refs] ${n}/${ids.length}`);
    await sleep(500);
  }
  return out;
});
console.log(`done: ${Object.keys(places).length} places, ${Object.keys(refs).length} events with external refs`);
