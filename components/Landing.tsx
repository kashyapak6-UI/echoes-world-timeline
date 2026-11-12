"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { motion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import { ArrowRight, GitBranch, Layers, Repeat } from "lucide-react";
import { useDataset } from "@/lib/data";
import { fmtSpan, fmtYear } from "@/lib/format";

const HeroGlobe = dynamic(() => import("./HeroGlobe").then((m) => m.HeroGlobe), { ssr: false });
gsap.registerPlugin(ScrollTrigger, useGSAP);

export function Landing() {
  const { data } = useDataset();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.1 });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (t: number) => { lenis.raf(t * 1000); };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => { gsap.ticker.remove(raf); lenis.destroy(); };
  }, []);

  useGSAP(() => {
    gsap.from(".hero-word", { yPercent: 110, opacity: 0, duration: 1.1, ease: "expo.out", stagger: 0.06, delay: 0.15 });
    gsap.from(".hero-fade", { y: 20, opacity: 0, duration: 1, ease: "power3.out", stagger: 0.1, delay: 0.6 });
    gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) => {
      gsap.from(el, { y: 50, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%" } });
    });
    gsap.to(".hero-globe", { scale: 0.75, opacity: 0.3, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
  }, { scope: root });

  const pandemic = data?.patterns.patterns.find((p) => p.id === "pandemic");
  const sample = useMemo(() => {
    if (!data) return null;
    // a well-connected event to showcase links (most connections among well-known events)
    return [...data.events].filter((e) => e.sl > 80).sort((a, b) => (data.adj.get(b.id)?.length ?? 0) - (data.adj.get(a.id)?.length ?? 0))[0] ?? null;
  }, [data]);

  const headline = ["Every", "event", "is", "an", "echo."];
  return (
    <div ref={root} className="grain bg-ink">
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-6 py-4 md:px-10">
        <span className="font-display text-2xl italic text-gold">Echoes</span>
        <nav className="flex items-center gap-6 text-sm text-muted">
          <Link href="/credits" className="hidden hover:text-white sm:block">Sources</Link>
          <Link href="/explore" className="rounded-full bg-gold px-4 py-2 font-medium text-ink transition hover:scale-[1.03]">Open the timeline</Link>
        </nav>
      </header>

      <section className="hero relative flex min-h-dvh items-center overflow-hidden">
        <div className="hero-globe absolute inset-0 md:left-[38%]">{data && <HeroGlobe events={data.events} colors={data.catColor} />}</div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-transparent" />
        <div className="relative z-10 max-w-3xl px-6 md:px-10">
          <p className="hero-fade text-[12px] uppercase tracking-[.3em] text-gold">A connected atlas of world history</p>
          <h1 className="mt-4 font-display text-[clamp(56px,9vw,128px)] leading-[.9]">
            {headline.map((w, i) => (
              <span key={i} className="inline-block overflow-hidden pb-2 pr-[.22em] align-bottom"><span className={`hero-word inline-block ${i === 4 ? "italic text-gold" : ""}`}>{w}</span></span>
            ))}
          </h1>
          <p className="hero-fade mt-6 max-w-xl text-lg leading-relaxed text-muted">
            From the first written records to today: wars, plagues, crashes, revolutions and the fall of empires — on one zoomable timeline and a living map.
            See what happened at the same time, what caused what, and which patterns keep coming back.
          </p>
          <div className="hero-fade mt-8 flex flex-wrap gap-3">
            <Link href="/explore" className="group flex items-center gap-2 rounded-full bg-gold px-6 py-3 font-medium text-ink">Start exploring <ArrowRight size={16} className="transition group-hover:translate-x-1" /></Link>
            <Link href="/explore?view=map" className="rounded-full border border-white/15 px-6 py-3 hover:border-gold/60">Open the map</Link>
          </div>
          {data && (
            <dl className="hero-fade mt-12 grid max-w-lg grid-cols-3 gap-6">
              {[
                [data.meta.counts.events.toLocaleString(), "events"],
                [data.meta.counts.edges.toLocaleString(), "connections"],
                [(() => { const first = data.events.filter((e) => e.c !== "era").reduce((a, b) => (b.s < a.s ? b : a)); return fmtYear(first.s, first.p).replace("c. ", "c.\u00a0"); })(), "earliest dated event"],
              ].map(([v, k]) => (
                <div key={k}><dt className="font-display text-4xl">{v}</dt><dd className="text-[12px] uppercase tracking-wider text-muted">{k}</dd></div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <section className="relative mx-auto grid max-w-6xl gap-6 px-6 py-28 md:grid-cols-3 md:px-10">
        {[
          { icon: GitBranch, t: "Connected", d: "Cause and effect, part-of and succession links come straight from Wikidata. Click any event to see its web drawn as arcs across time and space." },
          { icon: Layers, t: "Overlapping", d: "Ten regional lanes run in parallel, so the fall of one empire sits right above the rise of another. “Meanwhile elsewhere” lists what was happening at the same moment." },
          { icon: Repeat, t: "Repeating", d: "Sixteen recurring event types — pandemics, crashes, revolutions, famines, collapses — measured century by century, with the gaps between them." },
        ].map(({ icon: Icon, t, d }) => (
          <motion.div key={t} whileHover={{ y: -6 }} className="reveal rounded-3xl border border-line bg-panel/60 p-7">
            <Icon className="text-gold" size={22} />
            <h3 className="mt-6 font-display text-4xl">{t}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{d}</p>
          </motion.div>
        ))}
      </section>

      {pandemic && data && (
        <section className="reveal mx-auto max-w-6xl px-6 pb-28 md:px-10">
          <p className="text-[12px] uppercase tracking-[.3em] text-gold">Pattern preview</p>
          <h2 className="mt-3 font-display text-6xl leading-none">Plagues return.</h2>
          <p className="mt-4 max-w-xl text-muted">The best-known {pandemic.label.toLowerCase()} in the dataset, in time order, with the years between them.</p>
          <ol className="mt-10 flex flex-wrap items-center gap-y-4">
            {pandemic.echoes.map((e, i) => {
              const ev = data.byId.get(e.id);
              if (!ev) return null;
              return (
                <li key={e.id} className="flex items-center">
                  {i > 0 && <span className="mx-3 font-mono text-[11px] text-muted">+{fmtSpan(e.gap)}</span>}
                  <Link href={`/explore?event=${e.id}`} className="rounded-2xl border border-[#22c55e44] bg-[#22c55e0d] px-4 py-3 transition hover:bg-[#22c55e22]">
                    <div className="text-[15px]">{ev.t}</div>
                    <div className="font-mono text-[11px] text-muted">{fmtYear(e.at)}</div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {sample && data && (
        <section className="reveal mx-auto max-w-6xl px-6 pb-32 md:px-10">
          <div className="rounded-[2rem] border border-line bg-gradient-to-br from-panel to-ink p-10 md:p-14">
            <p className="text-[12px] uppercase tracking-[.3em] text-gold">Most connected</p>
            <h2 className="mt-3 font-display text-5xl leading-none md:text-6xl">{sample.t}</h2>
            <p className="mt-3 max-w-2xl text-muted">{sample.d}</p>
            <p className="mt-6 text-sm">{data.adj.get(sample.id)?.length} links in the graph — open it to see every arc.</p>
            <Link href={`/explore?event=${sample.id}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 font-medium text-ink">Explore its connections <ArrowRight size={16} /></Link>
          </div>
        </section>
      )}

      <footer className="border-t border-line px-6 py-10 text-[12px] text-muted md:px-10">
        Event data from <a className="underline" href="https://www.wikidata.org">Wikidata</a> (CC0) and summaries from <a className="underline" href="https://en.wikipedia.org">Wikipedia</a> (CC BY-SA 4.0). Map tiles © OpenStreetMap contributors via OpenFreeMap. <Link className="underline" href="/credits">Full sources &amp; licences</Link>.
      </footer>
    </div>
  );
}
