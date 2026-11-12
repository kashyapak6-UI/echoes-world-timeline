export type EventItem = {
  id: string; // Wikidata QID
  t: string; // label
  d: string; // Wikidata description (CC0)
  c: string; // primary category
  cs: string[]; // other categories
  s: number; // start (astronomical year, fractional)
  e: number; // end
  p: number; // Wikidata time precision (9=year, 8=decade, 7=century, 6=millennium, 10=month, 11=day)
  ll: [number, number] | null; // [lat, lon]
  ml?: [number, number][]; // all locations when the event has several (P276)
  lsrc: string | null; // where the coordinate came from (P625 / P276 / P36 / P17)
  r: string; // region id
  w: string | null; // English Wikipedia title
  x: string | null; // Wikipedia intro extract (CC BY-SA 4.0)
  xr: number | null; // Wikipedia revision id of the extract
  sl: number; // number of Wikipedia sitelinks (notability proxy)
  cc?: string[]; // present-day countries (Natural Earth ADM0_A3) of the event's location(s)
  rp?: RecordedLink[]; // recorded Wikidata links to places/countries (impact ripple)
  src?: { url: string; kind: "ref" | "described" }[]; // Wikidata reference URLs (P854) / described at (P973)
  rel?: string; // religion id
  rk?: "origin" | "founder" | "figure" | "scripture" | "site" | "event";
  ap?: 1; // approximate / uncertain date
  dn?: string[]; // date notes (alternative recorded values + qualifiers)
  of?: { at: string | null; by: string[] }; // religion origin: place of formation, founders
};
export type RecordedLink = { q: string; n: string; p: "P710" | "P17" | "P1542" | "P1344"; cc: string; via: string | null };
export type CountryMeta = { n: string; lab: [number, number]; r: string; wd: string };
export type Religion = { id: string; label: string; color: string; roots: string[] };
export type ReligionText = { title: string; url: string; host: string; licence: string };
export type ReligionsInfo = { religions: Religion[]; texts: Record<string, ReligionText[]>; skipped: { title: string; why: string }[]; stats: Record<string, Record<string, number>>; undated: { rel: string; id: string; label: string }[] };
export type EdgeKind = "cause" | "part" | "sequence" | "involves" | "shared";
export type Edge = { s: string; t: string; k: EdgeKind; v?: string };
export type Category = { id: string; label: string; color: string; span: boolean; n: number };
export type Region = { id: string; label: string };
export type Pattern = {
  id: string; label: string; color: string; measure: string; n: number; first: number; last: number;
  medianGap: number | null; p25Gap: number | null; p75Gap: number | null; medianGapLast500: number | null; nLast500: number;
  busiest: { century: number; n: number }[]; byCentury: Record<string, number>;
  echoes: { id: string; at: number; gap: number | null }[];
};
export type Meta = {
  generatedAt: string; fetchedAt: string;
  counts: Record<string, number>; edgeTypes: Record<string, number>;
  span: { first: number; last: number };
  categories: Category[]; regions: Region[];
  sources: { name: string; url: string; licence: string; use: string }[];
};
export type Dataset = {
  events: EventItem[]; edges: Edge[]; meta: Meta;
  patterns: { patterns: Pattern[]; concurrency: Record<string, number>; religions: { id: string; label: string; color: string; n: number; byCentury: Record<string, number> }[] };
  countries: Record<string, CountryMeta>;
  religions: ReligionsInfo;
  relById: Record<string, Religion>;
  colorOf: (e: EventItem) => string;
  byId: Map<string, EventItem>;
  adj: Map<string, { other: string; edge: Edge; dir: "out" | "in" }[]>;
  catColor: Record<string, string>;
};
