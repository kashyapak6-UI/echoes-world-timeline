"use client";
import { useEffect } from "react";
import { create } from "zustand";
import { isStaticExport } from "./config";

export type MeKey = { provider: string; model: string; baseUrl: string; masked: string; updatedAt: string; testedAt: string | null; testOk: boolean | null; testMsg: string | null };
export type Me = { id: string; email: string; name: string | null; createdAt: string; key: MeKey | null };
type S = { user: Me | null; loaded: boolean; refresh: () => Promise<void>; set: (u: Me | null) => void };
export const useMeStore = create<S>((set) => ({
  user: null, loaded: false,
  refresh: async () => { if (isStaticExport) { set({ user: null, loaded: true }); return; } try { const j = await (await fetch("/api/auth/me", { cache: "no-store" })).json(); set({ user: j.user, loaded: true }); } catch { set({ loaded: true }); } },
  set: (user) => set({ user, loaded: true }),
}));
let started = false;
export function useMe() {
  const s = useMeStore();
  useEffect(() => { if (!started) { started = true; s.refresh(); } }, [s]);
  return s;
}
