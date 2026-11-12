"use client";
import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { Dataset } from "@/lib/types";
import { useStore } from "@/lib/store";
import { fmtRange } from "@/lib/format";
import { focusEvent } from "@/lib/focus";
import { SourceLinks } from "./SourceLinks";

export function SearchBox({ data }: { data: Dataset }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return data.events
      .map((e) => {
        const t = e.t.toLowerCase();
        const score = t.startsWith(s) ? 3 : t.includes(s) ? 2 : e.d.toLowerCase().includes(s) ? 1 : 0;
        return { e, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.e.sl - a.e.sl)
      .slice(0, 8)
      .map((x) => x.e);
  }, [q, data]);
  const pick = (id: string) => { focusEvent(data, id); setOpen(false); setQ(""); ref.current?.blur(); };
  const view = useStore((s) => s.view);

  return (
    <div className="relative w-full max-w-sm">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input ref={ref} value={q} placeholder={`Search events (${view === "map" ? "fly to" : "jump to"})…`}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(results.length - 1, h + 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
          if (e.key === "Enter" && results[hi]) pick(results[hi].id);
        }}
        className="w-full rounded-full border border-line bg-panel py-2 pl-9 pr-4 text-sm outline-none transition placeholder:text-muted focus:border-gold/50" aria-label="Search events" />
      {open && results.length > 0 && (
        <ul className="glass absolute left-0 right-0 top-11 overflow-hidden rounded-xl py-1 shadow-2xl">
          {results.map((e, i) => (
            <li key={e.id}>
              <div onMouseDown={() => pick(e.id)} onMouseEnter={() => setHi(i)} role="option" aria-selected={i === hi}
                className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left ${i === hi ? "bg-white/5" : ""}`}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: data.colorOf(e) }} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm">{e.t}</span><SourceLinks ev={e} /></span>
                <span className="shrink-0 font-mono text-[11px] text-muted">{fmtRange(e.s, e.e, e.p)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
