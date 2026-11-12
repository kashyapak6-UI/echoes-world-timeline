// Client-safe types for live data.
export type LiveProvider = "GDELT" | "USGS" | "Wikipedia" | "NewsData.io" | "Currents" | "The Guardian";
export type LiveItem = {
  id: string; kind: "news" | "quake"; provider: LiveProvider; title: string; url: string;
  outlet?: string; date?: string; country?: string; lat?: number; lon?: number; mag?: number; place?: string; section?: string;
};
export type OnThisDayItem = { year: number; text: string; pages: { title: string; url: string; qid?: string }[] };
export type LiveResult<T> = { items: T[]; source: { name: string; url: string; licence: string }; fetchedAt: string; cached?: boolean; error?: string; note?: string };
export const LIVE_SOURCES = {
  gdelt: { name: "GDELT DOC 2.0 API", url: "https://www.gdeltproject.org", licence: "Free for any use incl. commercial, with citation + link to GDELT" },
  usgs: { name: "USGS Earthquake Hazards Program feeds", url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php", licence: "US public domain (USGS)" },
  otd: { name: "Wikipedia “On this day” (Wikimedia REST feed)", url: "https://api.wikimedia.org/wiki/Feed_API/Reference/On_this_day", licence: "Text CC BY-SA 4.0 (Wikipedia)" },
  newsdata: { name: "NewsData.io", url: "https://newsdata.io", licence: "Keyed API — headlines/links only, per NewsData.io terms" },
  currents: { name: "Currents API", url: "https://currentsapi.services", licence: "Keyed API — headlines/links only, per Currents terms" },
  guardian: { name: "The Guardian Open Platform", url: "https://open-platform.theguardian.com", licence: "Developer key is for non-commercial use; links back to theguardian.com required" },
} as const;
export const hostName = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
