"use client";
import type { EventItem } from "@/lib/types";
import { wdUrl, wikiRevUrl } from "@/lib/format";

/** Compact inline source links (Wikipedia revision + Wikidata) used in lists, chips, search and tooltips. */
export function SourceLinks({ ev, className = "" }: { ev: EventItem; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] ${className}`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      {ev.w && <a href={wikiRevUrl(ev.w, ev.xr)} target="_blank" rel="noopener noreferrer" title={`Wikipedia: ${ev.w}${ev.xr ? ` (revision ${ev.xr})` : ""}`} className="rounded border border-white/10 px-1 text-[#f5c97a] hover:bg-white/10">Wikipedia</a>}
      <a href={wdUrl(ev.id)} target="_blank" rel="noopener noreferrer" title={`Wikidata item ${ev.id}`} className="rounded border border-white/10 px-1 text-[#7cc4ff] hover:bg-white/10">Wikidata</a>
    </span>
  );
}
