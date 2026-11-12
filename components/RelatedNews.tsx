"use client";
import { useEffect, useState } from "react";
import type { LiveItem, LiveResult } from "@/lib/live";
import { LiveRow } from "./LiveLinks";

type R = { query: string; results: LiveResult<LiveItem>[] };
const memo = new Map<string, R>();
export function RelatedNews({ id }: { id: string }) {
  const [r, setR] = useState<R | null>(memo.get(id) ?? null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (memo.has(id)) { setR(memo.get(id)!); return; }
    setR(null); setLoading(true);
    const ac = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/live/related?id=${id}`, { signal: ac.signal }).then((x) => x.json()).then((j: R) => { memo.set(id, j); setR(j); }).catch(() => {}).finally(() => setLoading(false));
    }, 600); // debounce quick clicking (GDELT allows ~1 request / 5 s)
    return () => { clearTimeout(t); ac.abort(); };
  }, [id]);
  const items = r?.results.flatMap((x) => x.items) ?? [];
  return (
    <section className="mt-6 border-t border-line pt-4">
      <div className="mb-2 flex items-baseline justify-between"><h3 className="text-[12px] uppercase tracking-[.16em] text-white">Related live news</h3><span className="text-[10px] text-muted">GDELT · last 3 months</span></div>
      {loading && <p className="text-[12px] text-muted">Searching recent coverage…</p>}
      {r && items.length === 0 && <p className="text-[12px] text-muted">No recent articles mention {r.query}.{r.results.map((x) => x.error ? ` (${x.source.name}: ${x.error})` : "").join("")}</p>}
      <ul className="space-y-0.5">{items.slice(0, 8).map((it) => <LiveRow key={it.id} it={it} compact />)}</ul>
      {r && <p className="mt-1 text-[10px] text-muted">Search: {r.query} · {r.results.map((x, i) => <a key={i} href={x.source.url} target="_blank" rel="noopener noreferrer" className="mr-2 underline">{x.source.name}</a>)}</p>}
    </section>
  );
}
