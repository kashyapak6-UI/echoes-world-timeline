"use client";
import { useEffect, useState } from "react";
import type { CountryMeta, Dataset, Edge, EventItem, Meta, ReligionsInfo } from "./types";

let promise: Promise<Dataset> | null = null;
async function load(): Promise<Dataset> {
  const [events, edges, meta, patterns, countries, religions] = await Promise.all([
    fetch("/data/events.json").then((r) => r.json()) as Promise<EventItem[]>,
    fetch("/data/edges.json").then((r) => r.json()) as Promise<Edge[]>,
    fetch("/data/meta.json").then((r) => r.json()) as Promise<Meta>,
    fetch("/data/patterns.json").then((r) => r.json()) as Promise<Dataset["patterns"]>,
    fetch("/data/countries-meta.json").then((r) => r.json()) as Promise<Record<string, CountryMeta>>,
    fetch("/data/religions.json").then((r) => r.json()) as Promise<ReligionsInfo>,
  ]);
  const byId = new Map(events.map((e) => [e.id, e]));
  const adj: Dataset["adj"] = new Map();
  for (const e of edges) {
    if (!adj.has(e.s)) adj.set(e.s, []);
    if (!adj.has(e.t)) adj.set(e.t, []);
    adj.get(e.s)!.push({ other: e.t, edge: e, dir: "out" });
    adj.get(e.t)!.push({ other: e.s, edge: e, dir: "in" });
  }
  const catColor = Object.fromEntries(meta.categories.map((c) => [c.id, c.color]));
  const relById = Object.fromEntries(religions.religions.map((r) => [r.id, r]));
  const colorOf = (e: EventItem) => (e.c === "faith" && e.rel ? relById[e.rel]?.color : undefined) ?? catColor[e.c] ?? "#fff";
  return { events, edges, meta, patterns, byId, adj, catColor, countries, religions, relById, colorOf };
}
export function useDataset() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    promise ??= load();
    promise.then(setData).catch((e) => setError(String(e)));
  }, []);
  return { data, error };
}
