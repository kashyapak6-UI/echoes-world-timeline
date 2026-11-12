"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { useDataset } from "@/lib/data";
import { useStore, type View } from "@/lib/store";
import { Sidebar } from "./Sidebar";
import { SearchBox } from "./SearchBox";
import { DetailPanel } from "./DetailPanel";
import { TimelineCanvas } from "./TimelineCanvas";
import { TimeScrubber } from "./TimeScrubber";
import { PatternsView } from "./PatternsView";
import { ReligionsView } from "./ReligionsView";
import { LiveView } from "./LiveView";
import { AccountMenu } from "./AccountMenu";
import { focusEvent } from "@/lib/focus";

const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), { ssr: false, loading: () => <Loading label="Loading map…" /> });

const TABS: { id: View; label: string; hint: string }[] = [
  { id: "timeline", label: "Timeline", hint: "T" },
  { id: "map", label: "Map", hint: "M" },
  { id: "patterns", label: "Patterns", hint: "P" },
  { id: "religions", label: "Religions", hint: "R" },
  { id: "live", label: "Live", hint: "L" },
];

function Loading({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center text-sm text-muted">
      <div className="flex items-center gap-3"><span className="h-2 w-2 animate-ping rounded-full bg-gold" />{label}</div>
    </div>
  );
}

export function Explorer({ initialView }: { initialView?: View }) {
  const { data, error } = useDataset();
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);

  useEffect(() => {
    if (initialView) setView(initialView);
    const url = new URL(window.location.href);
    const ev = url.searchParams.get("event");
    const v = url.searchParams.get("view");
    if (v === "map" || v === "patterns" || v === "timeline" || v === "religions" || v === "live") setView(v);
    if (ev) select(ev);
  }, [initialView, setView, select]);

  useEffect(() => {
    if (!data) return;
    const ev = new URL(window.location.href).searchParams.get("event");
    if (ev && data.byId.has(ev)) focusEvent(data, ev);
  }, [data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Escape") select(null);
      if (e.key === "t") setView("timeline");
      if (e.key === "m") setView("map");
      if (e.key === "p") setView("patterns");
      if (e.key === "r") setView("religions");
      if (e.key === "l") setView("live");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select, setView]);

  return (
    <div className="grain flex h-dvh flex-col overflow-hidden bg-ink">
      <header className="relative z-30 flex h-14 shrink-0 items-center gap-4 border-b border-line px-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl italic leading-none text-gold">Echoes</span>
          <span className="hidden text-[11px] uppercase tracking-[.2em] text-muted md:inline">connected world history</span>
        </Link>
        <nav className="ml-2 flex rounded-full border border-line bg-panel p-1" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={view === t.id} onClick={() => setView(t.id)}
              className="relative rounded-full px-3 py-1.5 md:px-4 text-sm transition-colors data-[on=true]:text-ink" data-on={view === t.id}>
              {view === t.id && <motion.span layoutId="tab" className="absolute inset-0 rounded-full bg-gold" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="flex-1" />
        {data && <SearchBox data={data} />}
        <Link href="/ask" className="hidden rounded-full border border-[#c084fc55] px-3 py-1 text-sm text-[#e9d5ff] hover:bg-[#c084fc22] md:block">Ask Echoes</Link>
        <Link href="/credits" className="hidden text-sm text-muted hover:text-white xl:block">Sources &amp; licences</Link>
        <AccountMenu />
      </header>

      <div className="relative flex min-h-0 flex-1">
        {data && <Sidebar data={data} />}
        <main className="relative min-w-0 flex-1">
          {error && <div className="p-6 text-red-400">Failed to load data: {error}</div>}
          {!data && !error && <Loading label="Loading 5,000 years of events…" />}
          {data && (
            <AnimatePresence mode="wait">
              <motion.div key={view} className="absolute inset-0 flex flex-col" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                {view === "timeline" && <div className="relative min-h-0 flex-1"><TimelineCanvas data={data} /></div>}
                {view === "map" && <div className="relative min-h-0 flex-1"><MapView data={data} /></div>}
                {view === "patterns" && <PatternsView data={data} />}
                {view === "religions" && <ReligionsView data={data} />}
                {view === "live" && <LiveView data={data} />}
                {(view === "timeline" || view === "map") && <TimeScrubber data={data} />}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
        <AnimatePresence>{data && selected && <DetailPanel key="detail" data={data} id={selected} />}</AnimatePresence>
      </div>
    </div>
  );
}
