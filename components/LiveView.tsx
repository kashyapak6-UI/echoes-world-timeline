"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Activity, CalendarDays, Map as MapIcon, Newspaper, RefreshCw, Search } from "lucide-react";
import type { Dataset } from "@/lib/types";
import type { LiveItem, LiveResult, OnThisDayItem } from "@/lib/live";
import { useStore } from "@/lib/store";
import { focusEvent } from "@/lib/focus";
import { LiveRow } from "./LiveLinks";

type Keyed = { id: "newsdata" | "currents" | "guardian"; name: string; configured: boolean; cap: number; used: number; env: string; capEnv: string };
const A = { target: "_blank", rel: "noopener noreferrer" } as const;

export function LiveView({ data }: { data: Dataset }) {
  const setView = useStore((s) => s.setView);
  const setLiveLayer = useStore((s) => s.setLiveLayer);
  const today = new Date();
  const [date, setDate] = useState({ m: today.getMonth() + 1, d: today.getDate() });
  const [otd, setOtd] = useState<(LiveResult<OnThisDayItem> & { month: number; day: number }) | null>(null);
  const [q, setQ] = useState("");
  const [span, setSpan] = useState("1d");
  const [news, setNews] = useState<LiveResult<LiveItem> | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [feed, setFeed] = useState("4.5_week");
  const [quakes, setQuakes] = useState<LiveResult<LiveItem> | null>(null);
  const [keyed, setKeyed] = useState<Keyed[]>([]);
  const [keyedRes, setKeyedRes] = useState<Record<string, LiveResult<LiveItem>>>({});

  useEffect(() => { setOtd(null); fetch(`/api/live/onthisday?m=${date.m}&d=${date.d}`).then((r) => r.json()).then(setOtd).catch(() => {}); }, [date]);
  useEffect(() => { setQuakes(null); fetch(`/api/live/quakes?feed=${feed}`).then((r) => r.json()).then(setQuakes).catch(() => {}); }, [feed]);
  const loadNews = (query = q) => { setNewsLoading(true); fetch(`/api/live/news?q=${encodeURIComponent(query)}&timespan=${span}`).then((r) => r.json()).then(setNews).catch(() => {}).finally(() => setNewsLoading(false)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadNews(); }, [span]);
  useEffect(() => {
    fetch("/api/live/status").then((r) => r.json()).then((j) => {
      setKeyed(j.keyed);
      for (const k of j.keyed as Keyed[]) if (k.configured) fetch(`/api/live/keyed?provider=${k.id}`).then((r) => r.json()).then((x) => setKeyedRes((s) => ({ ...s, [k.id]: x })));
    }).catch(() => {});
  }, []);
  const showOnMap = (k: "quakes" | "news") => { setLiveLayer(k, true); setView("map"); };
  const label = new Date(2000, date.m - 1, date.d).toLocaleDateString(undefined, { day: "numeric", month: "long" });

  return (
    <div className="scroll-thin h-full overflow-y-auto px-6 pb-16 pt-6 md:px-10">
      <div className="max-w-3xl">
        <p className="text-[11px] uppercase tracking-[.2em] text-gold">Live</p>
        <h1 className="mt-1 font-display text-5xl leading-none">History, still being written.</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          Today’s anniversaries from Wikipedia, world news indexed by GDELT in the last hours, and earthquakes from the USGS — each item links to its original source.
          Live items are reports, not verified history; they are fetched on demand and cached briefly on the server.
        </p>
      </div>

      <div className="mt-8 grid gap-5 xl:grid-cols-3">
        {/* On this day */}
        <Panel icon={<CalendarDays size={15} />} title={`On this day · ${label}`} source={otd?.source} fetchedAt={otd?.fetchedAt}
          right={<input type="date" aria-label="Pick a date" className="rounded-md border border-line bg-panel px-2 py-0.5 text-[11px] text-muted"
            value={`2000-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`} onChange={(e) => { const [, m, d] = e.target.value.split("-").map(Number); if (m && d) setDate({ m, d }); }} />}>
          {!otd && <Skeleton />}
          {otd?.error && <Err msg={otd.error} />}
          {otd?.note && <Note msg={otd.note} />}
          <ol className="space-y-2">
            {otd?.items.slice(0, 40).map((x, i) => {
              const inSet = x.pages.map((p) => p.qid && data.byId.get(p.qid)).find(Boolean);
              return (
                <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.02 }} className="flex gap-3">
                  <span className="w-12 shrink-0 pt-0.5 text-right font-mono text-[12px] text-gold">{x.year < 0 ? `${-x.year} BCE` : x.year}</span>
                  <div className="min-w-0 text-[13px] leading-snug">
                    {x.text}
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px]">
                      {x.pages.slice(0, 3).map((p) => <a key={p.url} href={p.url} {...A} className="text-[#f5c97a] hover:underline">{p.title} ↗</a>)}
                      {inSet && <button onClick={() => { setView("timeline"); focusEvent(data, inSet.id); }} className="rounded border border-gold/40 px-1 text-gold hover:bg-gold/10">open in Echoes</button>}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </Panel>

        {/* GDELT news */}
        <Panel icon={<Newspaper size={15} />} title="World news (GDELT)" source={news?.source} fetchedAt={news?.fetchedAt}
          right={<button onClick={() => showOnMap("news")} className="flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted hover:text-white"><MapIcon size={11} /> map</button>}>
          <form onSubmit={(e) => { e.preventDefault(); loadNews(); }} className="mb-3 flex gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-panel px-2"><Search size={13} className="text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search live news (e.g. ceasefire)" className="w-full bg-transparent py-1.5 text-[13px] outline-none" aria-label="Search live news" /></div>
            <select value={span} onChange={(e) => setSpan(e.target.value)} className="rounded-lg border border-line bg-panel px-2 text-[12px]" aria-label="Time span">
              <option value="6h">6 h</option><option value="1d">24 h</option><option value="3d">3 days</option><option value="1w">1 week</option>
            </select>
            <button className="grid w-8 place-items-center rounded-lg border border-line" aria-label="Refresh"><RefreshCw size={13} className={newsLoading ? "animate-spin" : ""} /></button>
          </form>
          {!news && <Skeleton />}
          {news?.error && <Err msg={news.error} />}
          {news?.note && <Note msg={news.note} />}
          <ul className="space-y-0.5">{news?.items.slice(0, 40).map((it) => <LiveRow key={it.id} it={it} />)}</ul>
        </Panel>

        {/* USGS */}
        <Panel icon={<Activity size={15} />} title="Earthquakes (USGS)" source={quakes?.source} fetchedAt={quakes?.fetchedAt}
          right={<div className="flex gap-1.5">
            <select value={feed} onChange={(e) => setFeed(e.target.value)} className="rounded-md border border-line bg-panel px-1.5 py-0.5 text-[11px]" aria-label="Quake feed">
              <option value="significant_month">Significant · 30 d</option><option value="4.5_week">M4.5+ · 7 d</option><option value="2.5_day">M2.5+ · 24 h</option>
            </select>
            <button onClick={() => showOnMap("quakes")} className="flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted hover:text-white"><MapIcon size={11} /> map</button></div>}>
          {!quakes && <Skeleton />}
          {quakes?.error && <Err msg={quakes.error} />}
          {quakes?.note && <Note msg={quakes.note} />}
          {quakes && <p className="mb-2 text-[11px] text-muted">{quakes.items.length} events</p>}
          <ul className="space-y-0.5">{quakes?.items.slice(0, 40).map((it) => <LiveRow key={it.id} it={it} />)}</ul>
        </Panel>
      </div>

      {/* optional keyed APIs */}
      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        {keyed.map((k) => (
          <Panel key={k.id} icon={<Newspaper size={15} />} title={k.name} source={keyedRes[k.id]?.source} fetchedAt={keyedRes[k.id]?.fetchedAt}
            right={<span className="font-mono text-[10px] text-muted">{k.configured ? `${k.used}/${k.cap} today` : "optional"}</span>}>
            {!k.configured ? (
              <p className="text-[12px] text-muted">Not enabled. Set <code className="text-white">{k.env}</code> on the server (daily cap via <code className="text-white">{k.capEnv}</code>, default {k.cap}).{k.id === "guardian" && " Guardian developer keys are for non-commercial use."}</p>
            ) : (
              <>
                {!keyedRes[k.id] && <Skeleton />}
                {keyedRes[k.id]?.error && <Err msg={keyedRes[k.id].error!} />}
                <ul className="space-y-0.5">{keyedRes[k.id]?.items.slice(0, 15).map((it) => <LiveRow key={it.id} it={it} />)}</ul>
              </>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}

function Panel({ icon, title, right, children, source, fetchedAt }: { icon: React.ReactNode; title: string; right?: React.ReactNode; children: React.ReactNode; source?: { name: string; url: string; licence: string }; fetchedAt?: string }) {
  return (
    <section className="flex max-h-[78vh] flex-col rounded-2xl border border-line bg-panel/60">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-[13px] font-medium"><span className="text-gold">{icon}</span>{title}</h2>{right}
      </header>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 py-3">{children}</div>
      {source && <footer className="border-t border-line px-4 py-2 text-[10px] text-muted">Source: <a href={source.url} {...A} className="underline">{source.name}</a> · {source.licence}{fetchedAt ? ` · fetched ${new Date(fetchedAt).toLocaleTimeString()}` : ""}</footer>}
    </section>
  );
}
const Skeleton = () => <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-8 animate-pulse rounded bg-white/5" />)}</div>;
const Note = ({ msg }: { msg: string }) => <p className="mb-2 rounded-md border border-gold/30 bg-gold/10 px-2 py-1 text-[11px] text-[#f3dfb4]">{msg}</p>;
const Err = ({ msg }: { msg: string }) => <p className="mb-2 rounded-md border border-red-400/30 bg-red-400/10 px-2 py-1 text-[12px] text-red-200">{msg}</p>;
