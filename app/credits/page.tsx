import type { Metadata } from "next";
import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { EDGE_META } from "@/lib/edges";
import type { Meta, ReligionsInfo } from "@/lib/types";

export const metadata: Metadata = { title: "Sources & licences" };

const SOURCES = [
  { name: "Wikidata", url: "https://www.wikidata.org", licence: "CC0 1.0 (public domain)", lurl: "https://creativecommons.org/publicdomain/zero/1.0/", used: "Yes", what: "Every event item: label, short description, dates (P585/P580/P582/P571/P576/P575), coordinates (P625, or via location P276 / capital P36 / country P17), class (P31/P279), and the relations used as connections." },
  { name: "Wikipedia (English)", url: "https://en.wikipedia.org", licence: "CC BY-SA 4.0", lurl: "https://creativecommons.org/licenses/by-sa/4.0/", used: "Yes", what: "First 3 sentences of each article’s intro, shown verbatim with article title, revision id and licence notice. Any redistribution of these texts must stay CC BY-SA." },
  { name: "OpenFreeMap", url: "https://openfreemap.org", licence: "Free service (no key); map data © OpenStreetMap contributors, ODbL 1.0; OpenMapTiles schema", lurl: "https://www.openstreetmap.org/copyright", used: "Yes", what: "Dark and light vector basemaps for the map view. Attribution is shown on the map." },
  { name: "Natural Earth", url: "https://www.naturalearthdata.com", licence: "Public domain", lurl: "https://www.naturalearthdata.com/about/terms-of-use/", used: "Yes", what: "1:110m land polygons (offline map style, home-page globe) and 1:110m Admin-0 countries (impact-ripple shading, present-day country mapping, label points as arc targets)." },
  { name: "Wikisource / Project Gutenberg", url: "https://en.wikisource.org", licence: "Public-domain texts (each licence listed below)", lurl: "https://www.gutenberg.org/policy/license.html", used: "Linked only", what: "Religious texts in public-domain translations, linked from the Religions view and detail panels. Nothing is copied into this site." },
  { name: "MapLibre GL JS", url: "https://maplibre.org", licence: "BSD-3-Clause", lurl: "https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt", used: "Yes", what: "Map rendering, clustering and globe projection." },
  { name: "Cliopatria (Seshat)", url: "https://github.com/Seshat-Global-History-Databank/cliopatria", licence: "CC BY 4.0", lurl: "https://creativecommons.org/licenses/by/4.0/", used: "Planned", what: "Polity borders 3400 BCE–2024 CE with Wikidata ids — next step for historical borders on the map." },
  { name: "PeriodO", url: "https://perio.do", licence: "CC0", lurl: "https://perio.do/license/", used: "Planned", what: "Scholarly period definitions per region — next step for regional era bands." },
  { name: "Seshat Databank", url: "https://seshat-db.com", licence: "Current public data CC BY-SA 4.0 (older Equinox releases CC BY-NC-SA)", lurl: "https://seshat-db.com/terms/current/", used: "Candidate", what: "Social-complexity variables per polity; check the licence of the exact release before commercial use." },
  { name: "Our World in Data", url: "https://ourworldindata.org", licence: "CC BY 4.0 (charts & own data; third-party data keeps its own licence)", lurl: "https://ourworldindata.org/faqs#can-i-use-or-reproduce-your-data", used: "Candidate", what: "Long-run series (population, famine deaths, pandemics) to add context lines." },
  { name: "GDELT DOC 2.0 API", url: "https://www.gdeltproject.org", licence: "Free for any use incl. commercial; citation + link required", lurl: "https://www.gdeltproject.org/about.html#termsofuse", used: "Yes (live)", what: "Live news (Live tab, map layer by outlet country, ‘Related live news’ per event, Ask Echoes context). Headlines + links only; articles stay on the publishers’ sites." },
  { name: "USGS earthquake feeds", url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php", licence: "US public domain", lurl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits", used: "Yes (live)", what: "Earthquakes (significant / M4.5+ / M2.5+) in the Live tab and as a map layer, each linking to its USGS event page." },
  { name: "Wikipedia “On this day” (Wikimedia Feed API)", url: "https://api.wikimedia.org/wiki/Feed_API/Reference/On_this_day", licence: "CC BY-SA 4.0", lurl: "https://creativecommons.org/licenses/by-sa/4.0/", used: "Yes (live)", what: "Anniversaries for any date, linked to their Wikipedia articles and to matching Echoes events." },
  { name: "NewsData.io / Currents / The Guardian", url: "https://open-platform.theguardian.com", licence: "Keyed APIs under each provider’s terms (Guardian developer key: non-commercial)", lurl: "https://www.theguardian.com/open-platform/terms-and-conditions", used: "Optional", what: "Extra live news when the site owner sets the API keys; each has a server-side daily request cap." },
];

export default function Credits() {
  const meta = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/data/meta.json"), "utf8")) as Meta;
  const rel = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/data/religions.json"), "utf8")) as ReligionsInfo;
  const A = { target: "_blank", rel: "noopener noreferrer" } as const;
  return (
    <main className="mx-auto max-w-4xl px-6 py-14 md:px-10">
      <Link href="/" className="font-display text-2xl italic text-gold">Echoes</Link>
      <h1 className="mt-8 font-display text-6xl leading-none">Sources &amp; licences</h1>
      <p className="mt-4 text-muted">
        All event data on this site comes from open sources and is fetched by the scripts in <code className="text-white">/data</code>. Nothing is written by hand.
        Snapshot fetched {meta.fetchedAt.slice(0, 10)}: <span className="text-white">{meta.counts.events.toLocaleString()}</span> events, {" "}
        <span className="text-white">{meta.counts.edges.toLocaleString()}</span> connections, {meta.counts.withCoords.toLocaleString()} with coordinates, {meta.counts.withExtract.toLocaleString()} with a Wikipedia summary.
      </p>

      <div className="mt-10 overflow-hidden rounded-2xl border border-line">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-panel text-[11px] uppercase tracking-wider text-muted"><tr><th className="p-3">Source</th><th className="p-3">Licence</th><th className="p-3">Used</th><th className="p-3">For</th></tr></thead>
          <tbody>
            {SOURCES.map((s) => (
              <tr key={s.name} className="border-t border-line align-top">
                <td className="p-3"><a href={s.url} className="text-white underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer">{s.name}</a></td>
                <td className="p-3"><a href={s.lurl} className="text-gold underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer">{s.licence}</a></td>
                <td className="p-3 text-muted">{s.used}</td>
                <td className="p-3 text-muted">{s.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-14 font-display text-4xl">How connections are made</h2>
      <ul className="mt-4 space-y-3 text-[14px] text-muted">
        {Object.entries(EDGE_META).map(([k, m]) => (
          <li key={k} className="flex gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: m.color }} /><span><span className="text-white">{m.label}</span> ({meta.edgeTypes[k] ?? 0}) — {m.source}.</span></li>
        ))}
      </ul>

      <h2 className="mt-14 font-display text-4xl">How patterns are computed</h2>
      <p className="mt-4 text-[14px] leading-relaxed text-muted">
        Events are grouped by their Wikidata class (instance of / subclass of): e.g. pandemic, epidemic and disease outbreak become “Pandemics &amp; epidemics”. For each group we take the
        start date (or the end date for empires and dynasties, i.e. their fall), count events per century, and measure gaps between consecutive events. “Echoes” are the ten
        best-known events of each type (by number of Wikipedia language editions). These are descriptive statistics of what the open record contains — they do not predict anything,
        and they inherit Wikipedia’s coverage bias toward recent and European history.
      </p>
      <h2 className="mt-14 font-display text-4xl">Regions</h2>
      <p className="mt-4 text-[14px] leading-relaxed text-muted">
        Regions are derived from each event’s coordinates using simple latitude/longitude boxes (e.g. Europe, Middle East &amp; North Africa, South Asia). Events without coordinates in
        Wikidata, and events whose recorded locations (P276) fall in more than one region, sit in the “Global / multi-region” lane. Events without any coordinates are not drawn on the map;
        events with several locations get one marker per location. When an event has no coordinates of its own we use its location, its capital, or its country — the detail panel says which.
      </p>
      <h2 className="mt-14 font-display text-4xl">Sources on every event</h2>
      <p className="mt-4 text-[14px] leading-relaxed text-muted">
        Every event links to its origin wherever it appears: the timeline tooltip names the Wikipedia article (with revision) and Wikidata item; map popups and search results carry
        Wikipedia/Wikidata links; pattern “echo” chips have a ↗ source link; and the detail panel ends with a <span className="text-white">Sources</span> list — the exact Wikipedia revision the summary was taken from,
        the Wikidata item, and every external reference URL (P854) and “described at URL” (P973) recorded on the Wikidata item ({(meta.counts as Record<string, number>).withRefs?.toLocaleString()} events have at least one).
        All links open in a new tab with <code>rel=&quot;noopener noreferrer&quot;</code>. Live items (news, earthquakes, anniversaries) always show their outlet/provider and link to the original,
        and Ask Echoes answers cite numbered sources that link to the exact Wikipedia revision or news article.
      </p>

      <h2 className="mt-14 font-display text-4xl">Impact ripple</h2>
      <p className="mt-4 text-[14px] leading-relaxed text-muted">
        Select any event to see which present-day countries it touched and how. Every link carries its evidence type:
      </p>
      <ul className="mt-3 space-y-2 text-[14px] text-muted">
        <li><span className="text-[#f5c97a]">Recorded in Wikidata</span> — the event’s own location, and statements on the item: participant (P710), country (P17), has effect (P1542), plus people/states that list the event as “participant in” (P1344). Each linked item is placed by its own coordinates, capital, location, country or citizenship, then mapped to a present-day country with Natural Earth outlines. Continents, oceans and macro-regions are ignored.</li>
        <li><span className="text-[#7cc4ff]">Linked event (not causation)</span> — events connected in the graph (cause, part-of, sequence, shared participants…) located in another country and starting within a window after the event (half its duration, between 10 and 50 years).</li>
        <li><span className="text-[#c084fc]">AI-generated — verify</span> — optional. Signed-in users connect their own AI provider on their profile; the key is encrypted on the server (AES-256-GCM) and never sent to the browser. The model gets the Wikipedia summary and the recorded links, and its answer is labelled and listed with those sources.</li>
      </ul>
      <p className="mt-3 text-[14px] leading-relaxed text-muted">The split into social / economic / political-military comes from the class of the event or of the linked effect (e.g. a financial crisis is economic, a war is political-military, a famine or migration is social). Shading strength = number of independent links. Modern borders are used for orientation only; historical states are named in each link.</p>

      <h2 className="mt-14 font-display text-4xl">Religions</h2>
      <p className="mt-4 text-[14px] leading-relaxed text-muted">
        Origins, founders, key figures, texts, sites and events for {rel.religions.length} religions are selected from Wikidata (items whose religion, P140, is the faith or one of its branches,
        ranked by Wikipedia language editions). Dates are only the values recorded in Wikidata — inception, birth/death, publication, start/end. When several values exist (often a traditional and a scholarly one),
        all are shown with their qualifiers; “c.” marks circa / uncertain / coarse-precision dates. We never take dates from scripture. Origins with no inception in Wikidata: {rel.undated.map((u) => u.label).join(", ")}.
      </p>
      <div className="mt-6 overflow-hidden rounded-2xl border border-line">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-panel text-[11px] uppercase tracking-wider text-muted"><tr><th className="p-3">Religion</th><th className="p-3">Linked text</th><th className="p-3">Host</th><th className="p-3">Licence</th></tr></thead>
          <tbody>
            {rel.religions.flatMap((r) => (rel.texts[r.id] ?? []).map((t, i) => (
              <tr key={t.url} className="border-t border-line align-top">
                <td className="p-3" style={{ color: r.color }}>{i === 0 ? r.label : ""}</td>
                <td className="p-3"><a href={t.url} {...A} className="text-white underline-offset-2 hover:underline">{t.title}</a></td>
                <td className="p-3 text-muted">{t.host}</td>
                <td className="p-3 text-muted">{t.licence}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      <h3 className="mt-6 text-[12px] uppercase tracking-[.16em] text-white">Not linked, and why</h3>
      <ul className="mt-2 space-y-1.5 text-[13px] text-muted">{rel.skipped.map((s) => <li key={s.title}><span className="text-white">{s.title}</span> — {s.why}</li>)}</ul>

      <h2 className="mt-14 font-display text-4xl">Ask Echoes &amp; your AI key</h2>
      <p className="mt-4 text-[14px] leading-relaxed text-muted">
        Ask Echoes retrieves matching events from this dataset and recent GDELT headlines, numbers them, and asks <em>your</em> AI provider (OpenAI, Anthropic, Gemini, xAI, OpenRouter or any OpenAI-compatible endpoint)
        to answer only from them with citations. Keys are stored per user, encrypted with AES-256-GCM using a server secret, shown only as the last 4 characters, and used only from the server.
        Answers are AI-generated and must be verified against the cited sources.
      </p>

      <h2 className="mt-14 font-display text-4xl">Attribution</h2>
      <p className="mt-4 text-[14px] leading-relaxed text-muted">
        Wikipedia texts © Wikipedia contributors, CC BY-SA 4.0 — each summary links to its article. Map data © OpenStreetMap contributors (ODbL), tiles by OpenFreeMap, OpenMapTiles.
        Natural Earth land and country data: public domain. Religious texts are linked, not copied; each keeps its own status as listed above. Fonts: Instrument Serif, Inter, JetBrains Mono (SIL OFL 1.1).
      </p>
    </main>
  );
}
