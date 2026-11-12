"use client";
import { ExternalLink } from "lucide-react";
import type { LiveItem } from "@/lib/live";
import { hostName } from "@/lib/live";

const ago = (iso?: string) => {
  if (!iso) return "";
  const m = (Date.now() - Date.parse(iso)) / 60000;
  if (m < 60) return `${Math.max(1, Math.round(m))} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};
/** One live news / quake item with its outlet, provider and a link to the original. */
export function LiveRow({ it, compact = false }: { it: LiveItem; compact?: boolean }) {
  return (
    <li className="group rounded-md px-1.5 py-1.5 hover:bg-white/5">
      <a href={it.url} target="_blank" rel="noopener noreferrer" className={`block leading-snug group-hover:text-gold ${compact ? "text-[12px]" : "text-[13px]"}`}>
        {it.kind === "quake" && <span className="mr-1.5 rounded bg-[#ff7a59]/20 px-1 font-mono text-[11px] text-[#ffb199]">M{it.mag?.toFixed(1)}</span>}
        {it.title} <ExternalLink size={10} className="inline opacity-50" />
      </a>
      <div className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[10px] text-muted">
        <span className="text-[#cbd2e3]">{it.outlet ?? hostName(it.url)}</span>
        {it.country && <span>{it.country}</span>}
        {it.section && <span>{it.section}</span>}
        <span>{ago(it.date)}</span>
        <span>via {it.provider}</span>
      </div>
    </li>
  );
}
