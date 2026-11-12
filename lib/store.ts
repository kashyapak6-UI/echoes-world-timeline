"use client";
import { create } from "zustand";
import type { ScaleMode } from "./scale";
import type { RippleItem } from "./ripple";

export type View = "timeline" | "map" | "patterns" | "religions" | "live";
export type AiItem = RippleItem & { cc?: string };
type S = {
  view: View; setView: (v: View) => void;
  selected: string | null; select: (id: string | null) => void;
  hiddenCats: Set<string>; toggleCat: (id: string) => void; soloCat: (id: string | null, all: string[]) => void;
  hiddenRegions: Set<string>; toggleRegion: (id: string) => void;
  query: string; setQuery: (q: string) => void;
  scale: ScaleMode; setScale: (m: ScaleMode) => void;
  range: [number, number]; setRange: (r: [number, number]) => void; // year window shared by map & timeline
  minFame: number; setMinFame: (n: number) => void;
  hiddenRels: Set<string>; toggleRel: (id: string) => void; soloRel: (id: string | null, all: string[]) => void;
  ripple: boolean; setRipple: (b: boolean) => void;
  ai: Record<string, { status: "loading" | "done" | "error"; items: AiItem[]; error?: string; summary?: string; needsSetup?: boolean; sources?: { label: string; url: string }[]; model?: string }>;
  setAi: (id: string, v: S["ai"][string]) => void;
  liveLayers: { quakes: boolean; news: boolean }; setLiveLayer: (k: "quakes" | "news", on: boolean) => void;
};
export const useStore = create<S>((set) => ({
  view: "timeline", setView: (view) => set({ view }),
  selected: null, select: (selected) => set({ selected }),
  hiddenCats: new Set(["era"]),
  toggleCat: (id) => set((s) => { const h = new Set(s.hiddenCats); if (h.has(id)) h.delete(id); else h.add(id); return { hiddenCats: h }; }),
  soloCat: (id, all) => set(() => ({ hiddenCats: new Set(id ? all.filter((c) => c !== id) : ["era"]) })),
  hiddenRegions: new Set(),
  toggleRegion: (id) => set((s) => { const h = new Set(s.hiddenRegions); if (h.has(id)) h.delete(id); else h.add(id); return { hiddenRegions: h }; }),
  query: "", setQuery: (query) => set({ query }),
  scale: "deep", setScale: (scale) => set({ scale }),
  range: [-3499, 2026], setRange: (range) => set({ range }),
  minFame: 0, setMinFame: (minFame) => set({ minFame }),
  hiddenRels: new Set(),
  toggleRel: (id) => set((s) => { const h = new Set(s.hiddenRels); if (h.has(id)) h.delete(id); else h.add(id); return { hiddenRels: h }; }),
  soloRel: (id, all) => set(() => ({ hiddenRels: new Set(id ? all.filter((r) => r !== id) : []) })),
  ripple: true, setRipple: (ripple) => set({ ripple }),
  ai: {}, setAi: (id, v) => set((s) => ({ ai: { ...s.ai, [id]: v } })),
  liveLayers: { quakes: false, news: false }, setLiveLayer: (k, on) => set((s) => ({ liveLayers: { ...s.liveLayers, [k]: on } })),
}));
