"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, MapLayerMouseEvent, MapMouseEvent, StyleSpecification } from "maplibre-gl";
import { Globe2, Map as MapIcon } from "lucide-react";
import type { Dataset, EventItem } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useFilteredEvents } from "@/lib/filter";
import { fmtRange, hostOf, wikiRevUrl } from "@/lib/format";
import type { LiveItem } from "@/lib/live";
import { computeRipple, DIM_LABEL, EVIDENCE_META, type Ripple } from "@/lib/ripple";
import { EDGE_META } from "@/lib/edges";
import { asset, isStaticExport } from "@/lib/config";

// Basemaps: OpenFreeMap (free, no key; map data © OpenStreetMap contributors, ODbL; OpenMapTiles schema)
// and an offline fallback built from Natural Earth (public domain).
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const MINIMAL: StyleSpecification = {
  version: 8,
  glyphs: GLYPHS,
  sources: { land: { type: "geojson", data: asset("/data/land.geojson"), attribution: "Natural Earth (public domain)" } },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#07080c" } },
    { id: "land", type: "fill", source: "land", paint: { "fill-color": "#141826" } },
    { id: "coast", type: "line", source: "land", paint: { "line-color": "#2a3150", "line-width": 0.8 } },
  ],
};
const BASEMAPS = [
  { id: "dark", label: "Dark", style: "https://tiles.openfreemap.org/styles/dark" as string | StyleSpecification },
  { id: "positron", label: "Light", style: "https://tiles.openfreemap.org/styles/positron" as string | StyleSpecification },
  { id: "minimal", label: "Minimal (offline)", style: MINIMAL as string | StyleSpecification },
];
const FONT = ["Noto Sans Regular"];
maplibregl.setWorkerUrl(asset("/maplibre/maplibre-gl-worker.mjs"));
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function MapView({ data }: { data: Dataset }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [basemap, setBasemap] = useState("dark");
  const [globe, setGlobe] = useState(false);
  const filtered = useFilteredEvents(data);
  const range = useStore((s) => s.range);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const hoverPopup = useRef<maplibregl.Popup | null>(null);
  const rippleOn = useStore((s) => s.ripple);
  const aiState = useStore((s) => (selected ? s.ai[selected] : undefined));
  const ripple = useMemo<Ripple | null>(() => {
    const ev = selected ? data.byId.get(selected) : null;
    return ev && rippleOn ? computeRipple(data, ev, aiState?.items) : null;
  }, [selected, rippleOn, aiState, data]);
  const rippleRef = useRef(ripple);
  rippleRef.current = ripple;
  const liveLayers = useStore((s) => s.liveLayers);
  const setLiveLayer = useStore((s) => s.setLiveLayer);
  const [quakes, setQuakes] = useState<LiveItem[] | null>(null);
  const [news, setNews] = useState<LiveItem[] | null>(null);
  const [liveErr, setLiveErr] = useState<string | null>(null);
  const newsRef = useRef<Map<string, LiveItem[]>>(new Map());
  const clickPopup = useRef<maplibregl.Popup | null>(null);

  const inWin = useMemo(() => filtered.filter((e) => e.c !== "era" && e.e >= range[0] && e.s <= range[1]), [filtered, range]);
  const located = useMemo(() => inWin.filter((e) => e.ll), [inWin]);

  const fc = useMemo(() => {
    const span = range[1] - range[0];
    const newFrom = range[1] - span * 0.12;
    return {
      type: "FeatureCollection" as const,
      // events with several recorded locations get one marker per location
      features: located.flatMap((e) => (e.ml ?? [e.ll!]).map((ll) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [ll[1], ll[0]] },
        properties: { id: e.id, t: e.t, c: e.c, color: data.colorOf(e), sl: e.sl, isNew: e.s >= newFrom ? 1 : 0 },
      }))),
    };
  }, [located, range, data]);
  const fcRef = useRef(fc);
  fcRef.current = fc;

  // popup HTML with connected events
  const popupHtml = (ev: EventItem) => {
    const cat = data.meta.categories.find((c) => c.id === ev.c);
    const links = (data.adj.get(ev.id) ?? []).slice(0, 5).map((l) => {
      const o = data.byId.get(l.other); if (!o) return "";
      const m = EDGE_META[l.edge.k];
      return `<li style="display:flex;gap:6px;align-items:baseline"><span style="color:${m.color};font-size:10px;white-space:nowrap">${l.dir === "out" ? m.out : m.in}</span><span style="font-size:12px">${esc(o.t)}</span></li>`;
    }).join("");
    const n = data.adj.get(ev.id)?.length ?? 0;
    return `<div style="max-width:280px;font-family:var(--font-body)">
      <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${data.colorOf(ev)}">${esc((ev.rel ? data.relById[ev.rel]?.label : cat?.label) ?? ev.c)}</div>
      <div style="font-size:15px;font-weight:600;line-height:1.25;margin-top:2px">${esc(ev.t)}</div>
      <div style="font-family:var(--font-mono);font-size:11px;color:#8a90a6;margin-top:2px">${esc(fmtRange(ev.s, ev.e, ev.p))}</div>
      ${ev.d ? `<div style="font-size:12px;color:#b8bdd0;margin-top:6px">${esc(ev.d)}</div>` : ""}
      ${links ? `<ul style="margin:8px 0 0;padding:0;list-style:none;display:grid;gap:3px">${links}</ul>` : ""}
      ${n > 5 ? `<div style="font-size:11px;color:#8a90a6;margin-top:3px">+${n - 5} more connections in the panel →</div>` : ""}
      <div style="margin-top:8px;border-top:1px solid #1d2130;padding-top:6px">
        <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#8a90a6">Sources</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px;margin-top:2px">
        ${ev.w ? `<a href="${wikiRevUrl(ev.w, ev.xr)}" target="_blank" rel="noopener noreferrer" style="color:#f5c97a">Wikipedia${ev.xr ? ` (rev ${ev.xr})` : ""} ↗</a>` : ""}
        <a href="https://www.wikidata.org/wiki/${ev.id}" target="_blank" rel="noopener noreferrer" style="color:#7cc4ff">Wikidata ${ev.id} ↗</a>
        ${(ev.src ?? []).slice(0, 3).map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" style="color:#cbd2e3">${esc(hostOf(r.url))} ↗</a>`).join("")}
        ${(ev.src?.length ?? 0) > 3 ? `<span style="color:#8a90a6">+${ev.src!.length - 3} more in panel</span>` : ""}
      </div></div></div>`;
  };

  const addLayers = (map: maplibregl.Map) => {
    if (map.getSource("events")) return;
    map.addSource("events", {
      type: "geojson", data: fcRef.current, cluster: true, clusterMaxZoom: 5, clusterRadius: 44,
      clusterProperties: { fame: ["+", ["get", "sl"]] },
    });
    map.addSource("links", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    const empty = { type: "FeatureCollection" as const, features: [] };
    map.addSource("countries", { type: "geojson", data: asset("/data/countries.geojson"), attribution: "Country shapes: Natural Earth (public domain)" });
    map.addSource("ripple-arcs", { type: "geojson", data: empty });
    map.addSource("ripple-origin", { type: "geojson", data: empty });
    map.addLayer({ id: "ripple-fill", type: "fill", source: "countries", paint: { "fill-color": "#f5c97a", "fill-opacity": 0 } });
    map.addLayer({ id: "ripple-line", type: "line", source: "countries", paint: { "line-color": "#f5c97a", "line-width": 1, "line-opacity": 0 } });
    map.addLayer({ id: "ripple-arcs", type: "line", source: "ripple-arcs", layout: { "line-cap": "round" },
      paint: { "line-color": ["get", "color"], "line-width": ["interpolate", ["linear"], ["get", "s"], 0.5, 1, 6, 3], "line-opacity": 0.8 } });
    for (let i = 0; i < 3; i++) map.addLayer({ id: `ripple-ring-${i}`, type: "circle", source: "ripple-origin",
      paint: { "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#f5c97a", "circle-stroke-width": 2, "circle-radius": 0, "circle-stroke-opacity": 0, "circle-pitch-alignment": "map" } });
    map.addSource("live-quakes", { type: "geojson", data: empty, attribution: 'Quakes: <a href="https://earthquake.usgs.gov" target="_blank" rel="noopener noreferrer">USGS</a>' });
    map.addSource("live-news", { type: "geojson", data: empty, attribution: 'News: <a href="https://www.gdeltproject.org" target="_blank" rel="noopener noreferrer">GDELT</a>' });
    map.addLayer({ id: "live-quakes-halo", type: "circle", source: "live-quakes", paint: { "circle-color": "#ff7a59", "circle-opacity": 0.18, "circle-radius": ["interpolate", ["linear"], ["get", "mag"], 2.5, 6, 5, 14, 7, 30, 8, 42] } });
    map.addLayer({ id: "live-quakes", type: "circle", source: "live-quakes", paint: { "circle-color": "#ff7a59", "circle-stroke-color": "#07080c", "circle-stroke-width": 1, "circle-radius": ["interpolate", ["linear"], ["get", "mag"], 2.5, 2.5, 5, 5, 7, 10, 8, 14] } });
    map.addLayer({ id: "live-news", type: "circle", source: "live-news", paint: { "circle-color": "#7cf5c4", "circle-opacity": 0.75, "circle-stroke-color": "#07080c", "circle-stroke-width": 1.5, "circle-radius": ["interpolate", ["linear"], ["get", "n"], 1, 7, 10, 13, 40, 22] } });
    map.addLayer({ id: "live-news-count", type: "symbol", source: "live-news", layout: { "text-field": ["to-string", ["get", "n"]], "text-font": FONT, "text-size": 11, "text-allow-overlap": true }, paint: { "text-color": "#07080c" } });
    applyRipple(map);
    applyLive(map);
    map.addLayer({ id: "cluster-glow", type: "circle", source: "events", filter: ["has", "point_count"],
      paint: { "circle-color": "#f5c97a", "circle-opacity": 0.12, "circle-blur": 0.6,
        "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 2, 22, 50, 34, 300, 50, 1500, 64] } });
    map.addLayer({ id: "clusters", type: "circle", source: "events", filter: ["has", "point_count"],
      paint: { "circle-color": ["step", ["get", "point_count"], "#7cc4ff", 20, "#a78bfa", 80, "#f5c97a", 250, "#fb923c"],
        "circle-opacity": 0.85, "circle-stroke-width": 2, "circle-stroke-color": "rgba(7,8,12,.85)",
        "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 2, 11, 50, 18, 300, 28, 1500, 38] } });
    map.addLayer({ id: "cluster-count", type: "symbol", source: "events", filter: ["has", "point_count"],
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": FONT, "text-size": 12, "text-allow-overlap": true },
      paint: { "text-color": "#07080c" } });
    map.addLayer({ id: "links", type: "line", source: "links", layout: { "line-cap": "round" },
      paint: { "line-color": ["get", "color"], "line-width": 2, "line-opacity": 0.85, "line-dasharray": [2, 1.5] } });
    map.addLayer({ id: "new-halo", type: "circle", source: "events", filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "isNew"], 1]],
      paint: { "circle-color": ["get", "color"], "circle-opacity": 0.25, "circle-blur": 0.4,
        "circle-radius": ["interpolate", ["linear"], ["get", "sl"], 5, 10, 150, 20] } });
    map.addLayer({ id: "points", type: "circle", source: "events", filter: ["!", ["has", "point_count"]],
      paint: { "circle-color": ["get", "color"], "circle-stroke-color": "#07080c", "circle-stroke-width": 1.2,
        "circle-radius": ["interpolate", ["linear"], ["get", "sl"], 5, 4, 60, 6, 150, 9, 250, 11] } });
    map.addLayer({ id: "point-labels", type: "symbol", source: "events", filter: ["!", ["has", "point_count"]], minzoom: 3,
      layout: { "text-field": ["get", "t"], "text-font": FONT, "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top",
        "text-max-width": 12, "text-optional": true, "symbol-sort-key": ["-", 0, ["get", "sl"]] },
      paint: { "text-color": "#e8eaf2", "text-halo-color": "rgba(7,8,12,.9)", "text-halo-width": 1.4 } });
    map.addLayer({ id: "sel", type: "circle", source: "events", filter: ["==", ["get", "id"], ""],
      paint: { "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5, "circle-radius": 14 } });
  };

  // init
  useEffect(() => {
    if (!el.current) return;
    const map = new maplibregl.Map({
      container: el.current, style: BASEMAPS[0].style, center: [30, 28], zoom: 1.4, minZoom: 0.6, maxZoom: 12,
      attributionControl: { compact: false, customAttribution: 'Events: <a href="https://www.wikidata.org" target="_blank">Wikidata</a> (CC0) · <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a>' },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    // basemap unreachable (offline / blocked) -> fall back to the Natural Earth style
    const fallback = setTimeout(() => { if (!map.getSource("events")) setBasemap("minimal"); }, 9000);
    map.on("style.load", () => { addLayers(map); setReady(true); });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el.current);

    map.on("click", "clusters", async (e: MapLayerMouseEvent) => {
      const f = e.features?.[0]; if (!f) return;
      const src = map.getSource("events") as GeoJSONSource;
      const zoom = await src.getClusterExpansionZoom(f.properties!.cluster_id as number);
      map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.2, duration: 700 });
    });
    map.on("click", "points", (e: MapLayerMouseEvent) => {
      const f = e.features?.[0]; if (!f) return;
      useStore.getState().select(f.properties!.id as string);
    });
    map.on("click", (e: MapMouseEvent) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: ["points", "clusters"] });
      if (!hit.length) useStore.getState().select(null);
    });
    map.on("click", "live-quakes", (e: MapLayerMouseEvent) => {
      const p = e.features?.[0]?.properties; if (!p) return;
      clickPopup.current?.remove();
      clickPopup.current = new maplibregl.Popup({ offset: 10, maxWidth: "280px" }).setLngLat(e.lngLat).setHTML(
        `<div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#ff9a7f">Live · earthquake</div><div style="font-weight:600;font-size:14px;margin-top:2px">${esc(p.title)}</div><div style="font-family:var(--font-mono);font-size:11px;color:#8a90a6">${esc(new Date(p.date).toUTCString())}</div><div style="margin-top:6px;font-size:12px"><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" style="color:#f5c97a">USGS event page ↗</a></div><div style="font-size:10px;color:#8a90a6;margin-top:4px">Source: USGS Earthquake Hazards Program (public domain)</div>`).addTo(map);
    });
    map.on("click", "live-news", (e: MapLayerMouseEvent) => {
      const p = e.features?.[0]?.properties; if (!p) return;
      const items = newsRef.current.get(p.country as string) ?? [];
      clickPopup.current?.remove();
      clickPopup.current = new maplibregl.Popup({ offset: 10, maxWidth: "320px" }).setLngLat(e.lngLat).setHTML(
        `<div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#7cf5c4">Live news · outlets in ${esc(p.country)}</div><ul style="margin:6px 0 0;padding:0;list-style:none;display:grid;gap:6px">${items.slice(0, 6).map((a) => `<li><a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" style="color:#e8eaf2;font-size:12px;line-height:1.3">${esc(a.title)} ↗</a><div style="font-family:var(--font-mono);font-size:10px;color:#8a90a6">${esc(a.outlet ?? "")} · ${esc((a.date ?? "").slice(0, 16).replace("T", " "))} UTC</div></li>`).join("")}</ul>${items.length > 6 ? `<div style="font-size:10px;color:#8a90a6;margin-top:4px">+${items.length - 6} more in the Live tab</div>` : ""}<div style="font-size:10px;color:#8a90a6;margin-top:6px">Source: GDELT DOC API. Placed at the outlet's country, not the story's location.</div>`).addTo(map);
    });
    for (const l of ["live-quakes", "live-news"]) { map.on("mouseenter", l, () => (map.getCanvas().style.cursor = "pointer")); map.on("mouseleave", l, () => (map.getCanvas().style.cursor = "")); }
    hoverPopup.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: "hover-pop" });
    map.on("mousemove", "points", (e: MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = "pointer";
      const f = e.features?.[0]; if (!f) return;
      const ev = data.byId.get(f.properties!.id as string); if (!ev) return;
      if (useStore.getState().selected === ev.id) return;
      hoverPopup.current!.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
        .setHTML(`<div style="font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:${data.colorOf(ev)}">${esc((ev.rel ? data.relById[ev.rel]?.label : data.meta.categories.find((c) => c.id === ev.c)?.label) ?? "")}</div><div style="font-weight:600;font-size:13px">${esc(ev.t)}</div><div style="font-family:var(--font-mono);font-size:11px;color:#8a90a6">${esc(fmtRange(ev.s, ev.e, ev.p))}</div><div style="font-size:10px;color:#8a90a6;margin-top:2px">Source: ${ev.w ? `Wikipedia “${esc(ev.w)}” · ` : ""}Wikidata ${ev.id}${ev.src?.length ? ` · +${ev.src.length} refs` : ""} — click for links</div>`)
        .addTo(map);
    });
    map.on("mouseleave", "points", () => { map.getCanvas().style.cursor = ""; hoverPopup.current?.remove(); });
    // ripple: hover an affected country to see how it was affected
    map.on("mousemove", "ripple-fill", (e: MapLayerMouseEvent) => {
      const r = rippleRef.current; if (!r) return;
      if (map.queryRenderedFeatures(e.point, { layers: ["points", "clusters"] }).length) return;
      const cc = e.features?.[0]?.properties?.id as string;
      const c = r.countries.find((x) => x.cc === cc);
      if (!c) { hoverPopup.current?.remove(); return; }
      const dims = (["political", "social", "economic"] as const).map((d) => {
        const it = c.items.filter((i) => i.dim === d); if (!it.length) return "";
        return `<div style="margin-top:4px"><div style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#8a90a6">${DIM_LABEL[d]}</div>${it.slice(0, 3).map((i) => `<div style="font-size:11px;line-height:1.3;border-left:3px solid ${EVIDENCE_META[i.evidence].color};padding-left:5px;margin-top:2px">${esc(i.text)}</div>`).join("")}</div>`;
      }).join("");
      hoverPopup.current!.setLngLat(e.lngLat).setHTML(`<div style="max-width:260px"><div style="font-weight:600;font-size:13px">${esc(c.name)}${c.origin ? ' <span style="color:#f5c97a;font-size:10px">origin</span>' : ""}</div><div style="font-size:10px;color:#8a90a6">ripple strength ${c.strength} · ${c.items.length} link${c.items.length > 1 ? "s" : ""}</div>${dims}<div style="margin-top:5px;font-size:9px;color:#8a90a6">gold = recorded in Wikidata · blue = linked event (not causation) · purple = AI-generated, verify</div></div>`).addTo(map);
    });
    map.on("mouseleave", "ripple-fill", () => hoverPopup.current?.remove());
    map.on("mouseenter", "clusters", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "clusters", () => (map.getCanvas().style.cursor = ""));

    // animated dashes on connection arcs
    let step = 0;
    const dashes = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];
    const t0 = performance.now();
    const iv = setInterval(() => {
      if (map.getLayer("links") && map.isStyleLoaded()) { step = (step + 1) % dashes.length; map.setPaintProperty("links", "line-dasharray", dashes[step]); }
      if (map.getLayer("ripple-ring-0") && rippleRef.current?.origins.length) {
        // expanding rings from the origin
        const t = ((performance.now() - t0) / 2400) % 1;
        for (let i = 0; i < 3; i++) {
          const ph = (t + i / 3) % 1;
          map.setPaintProperty(`ripple-ring-${i}`, "circle-radius", 6 + ph * 70);
          map.setPaintProperty(`ripple-ring-${i}`, "circle-stroke-opacity", (1 - ph) * 0.85);
        }
      }
    }, 70);
    return () => { clearTimeout(fallback); clearInterval(iv); ro.disconnect(); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // basemap / projection switches
  const firstStyle = useRef(true);
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (firstStyle.current) { firstStyle.current = false; return; }
    const bm = BASEMAPS.find((b) => b.id === basemap)!;
    setReady(false);
    map.setStyle(bm.style);
  }, [basemap]);
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    map.setProjection({ type: globe ? "globe" : "mercator" });
  }, [globe, ready]);

  // data updates (throttled to animation frames)
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    const id = requestAnimationFrame(() => (map.getSource("events") as GeoJSONSource | undefined)?.setData(fc));
    return () => cancelAnimationFrame(id);
  }, [fc, ready]);

  // live layers (USGS quakes; GDELT news grouped by outlet country)
  const liveRef = useRef({ quakes, news, liveLayers });
  liveRef.current = { quakes, news, liveLayers };
  function applyLive(map: maplibregl.Map) {
    if (!map.getSource("live-quakes")) return;
    const { quakes: q, news: n, liveLayers: ll } = liveRef.current;
    (map.getSource("live-quakes") as GeoJSONSource).setData({ type: "FeatureCollection", features: ll.quakes ? (q ?? []).filter((x) => x.lat != null).map((x) => ({ type: "Feature" as const, properties: { title: x.title, url: x.url, mag: x.mag ?? 0, date: x.date }, geometry: { type: "Point" as const, coordinates: [x.lon!, x.lat!] } })) : [] });
    const byC = new Map<string, LiveItem[]>();
    for (const a of n ?? []) if (a.country) { if (!byC.has(a.country)) byC.set(a.country, []); byC.get(a.country)!.push(a); }
    newsRef.current = byC;
    const lab = new Map(Object.values(data.countries).map((c) => [c.n.toLowerCase(), c.lab]));
    const feats = ll.news ? [...byC.entries()].flatMap(([c, items]) => { const p = lab.get(c.toLowerCase()); return p ? [{ type: "Feature" as const, properties: { country: c, n: items.length }, geometry: { type: "Point" as const, coordinates: [p[1], p[0]] } }] : []; }) : [];
    (map.getSource("live-news") as GeoJSONSource).setData({ type: "FeatureCollection", features: feats });
  }
  useEffect(() => {
    if (isStaticExport) return;
    if (liveLayers.quakes && !quakes) fetch("/api/live/quakes?feed=4.5_week").then((r) => r.json()).then((j) => { setQuakes(j.items); if (j.error) setLiveErr(j.error); }).catch(() => setLiveErr("USGS unavailable"));
    if (liveLayers.news && !news) fetch("/api/live/news?timespan=1d").then((r) => r.json()).then((j) => { setNews(j.items); if (j.error) setLiveErr(j.error); }).catch(() => setLiveErr("GDELT unavailable"));
  }, [liveLayers, quakes, news]);
  useEffect(() => {
    const map = mapRef.current; if (map && ready) applyLive(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quakes, news, liveLayers, ready]);

  // impact ripple: country shading by strength, arcs from origin to each affected country, rings
  function applyRipple(map: maplibregl.Map) {
    if (!map.getLayer("ripple-fill")) return;
    const r = rippleRef.current;
    const empty = { type: "FeatureCollection" as const, features: [] };
    if (!r || !r.countries.length) {
      map.setPaintProperty("ripple-fill", "fill-opacity", 0);
      map.setPaintProperty("ripple-line", "line-opacity", 0);
      (map.getSource("ripple-arcs") as GeoJSONSource).setData(empty);
      (map.getSource("ripple-origin") as GeoJSONSource).setData(empty);
      for (let i = 0; i < 3; i++) map.setPaintProperty(`ripple-ring-${i}`, "circle-stroke-opacity", 0);
      return;
    }
    const max = Math.max(...r.countries.map((c) => c.strength));
    const strengthExpr: unknown[] = ["match", ["get", "id"]];
    for (const c of r.countries) strengthExpr.push(c.cc, c.strength / max);
    strengthExpr.push(0);
    map.setPaintProperty("ripple-fill", "fill-opacity", ["*", 0.55, strengthExpr] as never);
    map.setPaintProperty("ripple-line", "line-opacity", ["case", [">", strengthExpr, 0], 0.7, 0] as never);
    const colorExpr: unknown[] = ["match", ["get", "id"]];
    for (const c of r.countries) colorExpr.push(c.cc, c.origin ? "#ffd27a" : EVIDENCE_META[c.items.some((i) => i.evidence === "wikidata") ? "wikidata" : c.items.some((i) => i.evidence === "linked") ? "linked" : "ai"].color);
    colorExpr.push("#000");
    map.setPaintProperty("ripple-fill", "fill-color", colorExpr as never);
    const os = r.origins;
    // arcs start from the nearest recorded location of the event (events like WWI have several)
    const arcs = os.length ? r.countries.filter((c) => !c.origin).map((c) => {
      const o = os.reduce((b, p) => (Math.hypot(p[0] - c.lab[0], p[1] - c.lab[1]) < Math.hypot(b[0] - c.lab[0], b[1] - c.lab[1]) ? p : b), os[0]);
      const ev = c.items.some((i) => i.evidence === "wikidata") ? "wikidata" : c.items.some((i) => i.evidence === "linked") ? "linked" : "ai";
      return { type: "Feature" as const, properties: { color: EVIDENCE_META[ev].color, s: c.strength }, geometry: { type: "LineString" as const, coordinates: arc([o[1], o[0]], [c.lab[1], c.lab[0]]) } };
    }) : [];
    (map.getSource("ripple-arcs") as GeoJSONSource).setData({ type: "FeatureCollection", features: arcs });
    (map.getSource("ripple-origin") as GeoJSONSource).setData({ type: "FeatureCollection", features: os.map((p) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: [p[1], p[0]] } })) });
  }
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    applyRipple(map);
    if (ripple && ripple.countries.length > 1) {
      const pts = ripple.countries.map((c) => c.lab).concat(ripple.origins.length <= 3 ? ripple.origins : []);
      const lats = pts.map((p) => p[0]), lons = pts.map((p) => p[1]);
      if (Math.max(...lons) - Math.min(...lons) < 300) map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: { top: 120, bottom: 140, left: 300, right: 80 }, maxZoom: 4.5, duration: 1200 });
    }
  }, [ripple, ready]);

  // selection: ring, arcs to connected events, popup, fly-to
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    clickPopup.current?.remove();
    map.setFilter("sel", ["==", ["get", "id"], selected ?? ""]);
    const links = map.getSource("links") as GeoJSONSource | undefined;
    const ev = selected ? data.byId.get(selected) : null;
    if (!ev || !ev.ll) { links?.setData({ type: "FeatureCollection", features: [] }); return; }
    const a: [number, number] = [ev.ll[1], ev.ll[0]];
    const features = (data.adj.get(ev.id) ?? []).flatMap((l) => {
      const o = data.byId.get(l.other);
      if (!o?.ll) return [];
      const cand = (o.ml ?? [o.ll]).map((p) => [p[1], p[0]] as [number, number]);
      const b = cand.reduce((best, p) => (Math.hypot(p[0] - a[0], p[1] - a[1]) < Math.hypot(best[0] - a[0], best[1] - a[1]) ? p : best), cand[0]);
      if (Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01) return [];
      return [{ type: "Feature" as const, properties: { color: EDGE_META[l.edge.k].color }, geometry: { type: "LineString" as const, coordinates: arc(a, b) } }];
    });
    links?.setData({ type: "FeatureCollection", features });
    hoverPopup.current?.remove();
    clickPopup.current = new maplibregl.Popup({ offset: 14, maxWidth: "300px" }).setLngLat(a).setHTML(popupHtml(ev)).addTo(map);
    const z = map.getZoom();
    if (!rippleRef.current || rippleRef.current.countries.length < 2) map.flyTo({ center: a, zoom: Math.max(z, 3.2), speed: 1.4, offset: [0, 80] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, ready]);

  const unlocated = inWin.length - located.length;
  const top = useMemo(() => [...located].sort((x, y) => y.sl - x.sl).slice(0, 5), [located]);

  return (
    <div className="absolute inset-0">
      <div ref={el} style={{ position: "absolute", inset: 0 }} />
      <div className="glass absolute left-3 top-3 z-10 w-64 rounded-2xl p-3 text-[12px]">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-2xl italic text-gold">{located.length.toLocaleString()}</span>
          <span className="text-muted">events on the map</span>
        </div>
        <div className="mt-0.5 text-[11px] text-muted">{unlocated > 0 ? `${unlocated} more in this window have no coordinates in Wikidata` : "all events in this window are located"}</div>
        {top.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-line pt-2">
            {top.map((e) => (
              <li key={e.id}>
                <button onClick={() => select(e.id)} className="flex w-full items-center gap-2 text-left hover:text-gold">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: data.colorOf(e) }} />
                  <span className="truncate">{e.t}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="glass absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-full p-1 text-[11px]">
        {BASEMAPS.map((b) => (
          <button key={b.id} onClick={() => setBasemap(b.id)} className={`rounded-full px-2.5 py-1 transition ${basemap === b.id ? "bg-white/10 text-white" : "text-muted hover:text-white"}`}>{b.label}</button>
        ))}
        <span className="mx-1 h-4 w-px bg-line" />
        <button onClick={() => setGlobe(!globe)} className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition ${globe ? "bg-gold text-ink" : "text-muted hover:text-white"}`}>
          {globe ? <Globe2 size={12} /> : <MapIcon size={12} />} {globe ? "Globe" : "Flat"}
        </button>
      </div>
      {ripple && ripple.countries.length > 0 && (
        <div className="glass absolute bottom-14 left-3 z-10 w-64 rounded-2xl p-3 text-[11px]">
          <div className="text-[10px] uppercase tracking-[.16em] text-gold">Impact ripple · {ripple.countries.length} countries</div>
          <ul className="mt-1.5 space-y-1">
            {(["wikidata", "linked", "ai"] as const).map((k) => (
              <li key={k} className="flex items-center gap-2 text-muted"><span className="h-1.5 w-4 rounded" style={{ background: EVIDENCE_META[k].color }} />{EVIDENCE_META[k].label}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] leading-snug text-muted">Shading = number of recorded links. Linked events are searched until {fmtRange(ripple.windowEnd, ripple.windowEnd, 9)}. Hover a country for details.</p>
        </div>
      )}
      <div className="glass absolute right-14 top-14 z-10 w-56 rounded-xl p-3 text-[12px]">
        <div className="text-[10px] uppercase tracking-[.16em] text-muted">Live layers</div>
        {isStaticExport ? (
          <p className="mt-1.5 text-[10px] leading-snug text-muted">Live earthquake and news layers need the Echoes server (USGS and GDELT are fetched server-side). Run the project locally to turn them on.</p>
        ) : (
          <>
            <label className="mt-1.5 flex items-center gap-2"><input type="checkbox" checked={liveLayers.quakes} onChange={(e) => setLiveLayer("quakes", e.target.checked)} className="accent-[#ff7a59]" /><span className="h-2 w-2 rounded-full bg-[#ff7a59]" />Earthquakes M4.5+ · 7 d{liveLayers.quakes && quakes && <span className="ml-auto font-mono text-[10px] text-muted">{quakes.length}</span>}</label>
            <label className="mt-1 flex items-center gap-2"><input type="checkbox" checked={liveLayers.news} onChange={(e) => setLiveLayer("news", e.target.checked)} className="accent-[#7cf5c4]" /><span className="h-2 w-2 rounded-full bg-[#7cf5c4]" />News · 24 h{liveLayers.news && news && <span className="ml-auto font-mono text-[10px] text-muted">{news.length}</span>}</label>
            <p className="mt-1.5 text-[10px] leading-snug text-muted">Sources: <a className="underline" href="https://earthquake.usgs.gov/earthquakes/feed/" target="_blank" rel="noopener noreferrer">USGS</a> · <a className="underline" href="https://www.gdeltproject.org" target="_blank" rel="noopener noreferrer">GDELT</a>. News sits at the outlet’s country. Click a dot for links.</p>
            {liveErr && <p className="mt-1 text-[10px] text-red-300">{liveErr}</p>}
          </>
        )}
      </div>
      <div className="glass absolute right-14 top-3 z-10 hidden rounded-xl px-3 py-2 text-[11px] text-muted lg:block">
        Clusters show counts — click to zoom in · halos = events starting near the end of the window
      </div>
    </div>
  );
}

/** Curved arc between two lon/lat points (quadratic bezier with a perpendicular lift). */
function arc(a: [number, number], b: [number, number], n = 48): [number, number][] {
  let ax = a[0]; const ay = a[1]; const [bx, by] = b;
  if (Math.abs(bx - ax) > 180) ax += bx > ax ? 360 : -360;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const dx = bx - ax, dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const cx = mx - dy * 0.25, cy = my + dx * 0.25 + dist * 0.05;
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([(1 - t) ** 2 * ax + 2 * (1 - t) * t * cx + t * t * bx, Math.max(-85, Math.min(85, (1 - t) ** 2 * ay + 2 * (1 - t) * t * cy + t * t * by))]);
  }
  return out;
}
