"use client";
import { useMemo } from "react";
import type { Dataset, EventItem } from "./types";
import { useStore } from "./store";

/** Events passing category / region / fame filters (not the time window). */
export function useFilteredEvents(data: Dataset | null): EventItem[] {
  const hiddenCats = useStore((s) => s.hiddenCats);
  const hiddenRegions = useStore((s) => s.hiddenRegions);
  const minFame = useStore((s) => s.minFame);
  const hiddenRels = useStore((s) => s.hiddenRels);
  return useMemo(() => {
    if (!data) return [];
    return data.events.filter((e) => !hiddenCats.has(e.c) && !hiddenRegions.has(e.r) && e.sl >= minFame && !(e.rel && hiddenRels.has(e.rel)));
  }, [data, hiddenCats, hiddenRegions, minFame, hiddenRels]);
}

export function inWindow(e: EventItem, a: number, b: number) {
  return e.e >= a && e.s <= b;
}

/** Events overlapping in time with `ev`, in other regions, best known first. */
export function concurrentWith(data: Dataset, ev: EventItem, n = 8) {
  const pad = Math.max(1, (ev.e - ev.s) * 0.05);
  return data.events
    .filter((o) => o.id !== ev.id && o.c !== "era" && o.e >= ev.s - pad && o.s <= ev.e + pad && o.r !== ev.r)
    .sort((a, b) => b.sl - a.sl)
    .slice(0, n);
}

/** Same pattern category, the best-known instances elsewhere in time. */
export function echoesOf(data: Dataset, ev: EventItem, n = 6) {
  const span = 50;
  return data.events
    .filter((o) => o.id !== ev.id && o.c === ev.c && Math.abs(o.s - ev.s) > span)
    .sort((a, b) => b.sl - a.sl)
    .slice(0, n)
    .sort((a, b) => a.s - b.s);
}
