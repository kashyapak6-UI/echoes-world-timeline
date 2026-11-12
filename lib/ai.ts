"use client";
// "Explain impact": calls the server, which uses the signed-in user's encrypted, server-side stored key.
// No key ever exists in the browser.
import type { Dataset, EventItem } from "./types";
import type { Ripple } from "./ripple";
import type { AiItem } from "./store";
import { useStore } from "./store";

export async function explainImpact(data: Dataset, ev: EventItem, ripple: Ripple) {
  const st = useStore.getState();
  st.setAi(ev.id, { status: "loading", items: [] });
  const recorded = ripple.countries.map((c) => `- ${c.name}${c.origin ? " (event location)" : ""}: ${c.items.filter((i) => i.evidence !== "ai").map((i) => `[${i.evidence}] ${i.text}`).join("; ")}`);
  try {
    const res = await fetch("/api/ai/impact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: ev.id, recorded }) });
    const j = await res.json();
    if (!res.ok) { st.setAi(ev.id, { status: "error", items: [], error: j.error ?? `HTTP ${res.status}`, needsSetup: res.status === 401 || res.status === 400 }); return; }
    const byName = new Map(Object.entries(data.countries).map(([cc, m]) => [m.n.toLowerCase(), cc]));
    const items: AiItem[] = [];
    for (const c of j.countries ?? []) {
      const name = String(c.country ?? "").toLowerCase();
      const cc = byName.get(name) ?? [...byName.entries()].find(([n]) => n.includes(name) || name.includes(n))?.[1];
      if (!cc) continue;
      for (const dim of ["social", "economic", "political"] as const) {
        const v = String(c[dim] ?? "").trim();
        if (v && !/^unknown\.?$/i.test(v)) items.push({ cc, dim, evidence: "ai", text: v });
      }
    }
    st.setAi(ev.id, { status: "done", items, summary: j.summary, sources: j.sources, model: j.model });
  } catch (e) {
    st.setAi(ev.id, { status: "error", items: [], error: String(e) });
  }
}
