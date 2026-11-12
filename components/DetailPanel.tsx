"use client";
import { useMemo } from "react";
import { motion } from "motion/react";
import { BookOpen, ExternalLink, MapPin, Sparkles, X } from "lucide-react";
import type { Dataset, EdgeKind, EventItem } from "@/lib/types";
import { useStore } from "@/lib/store";
import { fmtRange, fmtSpan, hostOf, wdUrl, wikiRevUrl, wikiUrl } from "@/lib/format";
import { EDGE_META } from "@/lib/edges";
import { concurrentWith, echoesOf } from "@/lib/filter";
import { focusEvent } from "@/lib/focus";
import { computeRipple, DIM_LABEL, EVIDENCE_META, type Dim } from "@/lib/ripple";
import { explainImpact } from "@/lib/ai";
import { useMe } from "@/lib/useMe";
import { RelatedNews } from "./RelatedNews";
import { SourceLinks } from "./SourceLinks";
import { isStaticExport } from "@/lib/config";
import { StaticNote } from "./StaticUnavailable";

const LOC_SRC: Record<string, string> = { P625: "event coordinates", P276: "location's coordinates", P36: "capital's coordinates", P17: "country's coordinates (approximate)", P740: "place of formation", P19: "place of birth", P131: "administrative area" };
const RK_LABEL: Record<string, string> = { origin: "Origin of the religion", founder: "Founder (Wikidata P112)", figure: "Religious figure (birth – death)", scripture: "Scripture / religious text", site: "Place of worship (founded)", event: "Religious event / institution" };
const A = { target: "_blank", rel: "noopener noreferrer" } as const;

export function DetailPanel({ data, id }: { data: Dataset; id: string }) {
  const ev = data.byId.get(id);
  const select = useStore((s) => s.select);
  const setView = useStore((s) => s.setView);
  const ai = useStore((s) => s.ai[id]);
  const ripple = useMemo(() => (ev ? computeRipple(data, ev, ai?.items) : null), [data, ev, ai]);
  const me = useMe();
  const hasAi = !!me.user?.key;
  if (!ev || !ripple) return null;
  const cat = data.meta.categories.find((c) => c.id === ev.c);
  const rel = ev.rel ? data.relById[ev.rel] : null;
  const color = data.colorOf(ev);
  const region = data.meta.regions.find((r) => r.id === ev.r);
  const links = data.adj.get(ev.id) ?? [];
  const groups = new Map<string, { kind: EdgeKind; title: string; items: { o: EventItem; via?: string }[] }>();
  for (const l of links) {
    const o = data.byId.get(l.other); if (!o) continue;
    const m = EDGE_META[l.edge.k];
    const title = l.dir === "out" ? m.out : m.in;
    const key = `${l.edge.k}:${title}`;
    if (!groups.has(key)) groups.set(key, { kind: l.edge.k, title, items: [] });
    groups.get(key)!.items.push({ o, via: l.edge.v && (l.edge.k === "shared" || l.edge.k === "involves") ? l.edge.v : undefined });
  }
  const conc = concurrentWith(data, ev, 6);
  const echoes = echoesOf(data, ev, 6);
  const go = (oid: string) => focusEvent(data, oid);
  const texts = ev.rel ? data.religions.texts[ev.rel] ?? [] : [];

  return (
    <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: "spring", bounce: 0, duration: 0.35 }}
      className="scroll-thin absolute inset-y-0 right-0 z-30 w-full shrink-0 overflow-y-auto border-l border-line bg-panel/95 backdrop-blur md:relative md:w-[400px]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel/95 px-5 py-3">
        <span className="flex items-center gap-2 text-[11px] uppercase tracking-[.16em]" style={{ color }}>
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />{rel ? `${rel.label} · ${RK_LABEL[ev.rk ?? "event"]}` : cat?.label}
        </span>
        <button onClick={() => select(null)} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-white/5 hover:text-white" aria-label="Close details"><X size={16} /></button>
      </div>
      <div className="px-5 pb-10 pt-4">
        <h2 className="font-display text-[32px] leading-[1.05] text-balance">{ev.t}</h2>
        <div className="mt-2 font-mono text-[12px] text-gold">
          {ev.ap && !fmtRange(ev.s, ev.e, ev.p).startsWith("c.") ? "c. " : ""}{fmtRange(ev.s, ev.e, ev.p)}{ev.e - ev.s >= 1 && <span className="text-muted"> · {fmtSpan(ev.e - ev.s)}</span>}
          {ev.ap && <span className="ml-2 rounded border border-gold/30 px-1 text-[10px]">uncertain date</span>}
        </div>
        {ev.dn && (
          <ul className="mt-2 space-y-1 rounded-lg border border-gold/20 bg-gold/5 p-2 text-[11px] text-[#e9d9b5]">
            {ev.dn.map((n) => <li key={n}>{n}</li>)}
            <li className="text-muted">Traditional and scholarly dates can differ; every value recorded in Wikidata is listed, none is chosen by us.</li>
          </ul>
        )}
        <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
          <MapPin size={12} /> {region?.label}{ev.lsrc && <span className="text-[11px]">· from {ev.ml ? `${ev.ml.length} recorded locations` : LOC_SRC[ev.lsrc] ?? ev.lsrc}</span>}
        </div>
        {ev.of && (ev.of.at || ev.of.by.length > 0) && (
          <p className="mt-2 text-[12px] text-muted">{ev.of.at && <>Place of formation (Wikidata P740): <span className="text-white">{ev.of.at}</span>. </>}{ev.of.by.length > 0 && <>Founded by (P112): <span className="text-white">{ev.of.by.join(", ")}</span>.</>}</p>
        )}
        {ev.d && <p className="mt-3 text-[13px] italic text-[#b8bdd0]">{ev.d}</p>}
        {ev.x && (
          <div className="mt-3">
            <p className="text-[14px] leading-relaxed text-[#d7dbe8]">{ev.x}</p>
            <p className="mt-2 text-[10px] text-muted">
              Text from Wikipedia article “{ev.w}”{ev.xr ? ` (revision ${ev.xr})` : ""}, licensed <a className="underline" href="https://creativecommons.org/licenses/by-sa/4.0/" {...A}>CC BY-SA 4.0</a>.
            </p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
          {ev.ll && <button onClick={() => setView("map")} className="rounded-full border border-line px-3 py-1 hover:border-gold/50">Show on map</button>}
          <button onClick={() => { setView("timeline"); go(ev.id); }} className="rounded-full border border-line px-3 py-1 hover:border-gold/50">Focus timeline</button>
        </div>

        {texts.length > 0 && (
          <Section title="Read the source texts" hint="Public-domain / open">
            <ul className="space-y-1.5">
              {texts.map((t) => (
                <li key={t.url}><a href={t.url} {...A} className="group flex items-start gap-2 text-[13px] hover:text-gold"><BookOpen size={13} className="mt-0.5 shrink-0" style={{ color }} />
                  <span><span className="block leading-snug">{t.title} <ExternalLink size={10} className="inline" /></span><span className="block text-[10px] text-muted">{t.host} · {t.licence}</span></span></a></li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Impact ripple" hint="Where and how it spread">
          {ripple.countries.length === 0 ? <p className="text-[12px] text-muted">No recorded links to other countries in Wikidata for this event.</p> : (
            <>
              <div className="mb-2 flex flex-wrap gap-2 text-[10px]">
                {(["wikidata", "linked", "ai"] as const).map((k) => <span key={k} className="flex items-center gap-1"><span className="h-1.5 w-3 rounded" style={{ background: EVIDENCE_META[k].color }} />{EVIDENCE_META[k].label}</span>)}
              </div>
              <ul className="space-y-2">
                {ripple.countries.slice(0, 14).map((c) => {
                  const byDim = new Map<Dim, typeof c.items>();
                  for (const it of c.items) { if (!byDim.has(it.dim)) byDim.set(it.dim, []); byDim.get(it.dim)!.push(it); }
                  return (
                    <li key={c.cc} className="rounded-lg bg-white/[.03] p-2">
                      <div className="flex items-baseline justify-between text-[13px]"><span className="text-white">{c.name}{c.origin && <span className="ml-1.5 text-[10px] text-gold">origin</span>}</span><span className="font-mono text-[10px] text-muted">strength {c.strength}</span></div>
                      {[...byDim.entries()].map(([dim, items]) => (
                        <div key={dim} className="mt-1">
                          <div className="text-[10px] uppercase tracking-wider text-muted">{DIM_LABEL[dim]}</div>
                          <ul className="space-y-0.5">
                            {items.slice(0, 4).map((it, i) => (
                              <li key={i} className="flex gap-1.5 text-[12px] leading-snug">
                                <span className="mt-1.5 h-1 w-2.5 shrink-0 rounded" style={{ background: EVIDENCE_META[it.evidence].color }} title={EVIDENCE_META[it.evidence].label} />
                                <span>
                                  {it.eventId ? <button className="text-left hover:text-gold" onClick={() => go(it.eventId!)}>{it.text}</button> : it.text}
                                  {it.qid && <a href={wdUrl(it.qid)} {...A} className="ml-1 text-[10px] text-[#7cc4ff]">{it.prop} ↗</a>}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <div className="mt-3 rounded-lg border border-[#c084fc33] p-2 text-[12px]">
            {isStaticExport ? (
              <StaticNote>Explain impact (AI) needs the local Echoes server, where you can sign in and connect your own API key. It isn’t available on this GitHub Pages demo. The recorded Wikidata ripple above still works.</StaticNote>
            ) : (
              <>
            <button onClick={() => explainImpact(data, ev, ripple)} disabled={ai?.status === "loading"} className="flex items-center gap-1.5 rounded-full bg-[#c084fc22] px-3 py-1 text-[#e9d5ff] hover:bg-[#c084fc33] disabled:opacity-50">
              <Sparkles size={12} /> {ai?.status === "loading" ? "Asking your AI…" : "Explain impact (AI)"}
            </button>
            <p className="mt-1.5 text-[10px] text-muted">
              {hasAi ? <>Uses the {me.user!.key!.provider} key stored (encrypted) on your profile — it never reaches this browser.</> : me.user ? <>Connect an AI provider on your <a href="/profile" className="underline">profile</a> to enable.</> : <><a href="/login" className="underline">Sign in</a> and connect an AI provider to enable.</>}
              {" "}AI text is labelled “AI-generated — verify” and grounded in the Wikipedia text and recorded links above.
            </p>
            {ai?.status === "error" && <p className="mt-1 text-[11px] text-red-300">AI request failed: {ai.error}{ai.needsSetup && <> — <a href={me.user ? "/profile" : "/login"} className="underline">{me.user ? "open profile" : "sign in"}</a></>}</p>}
            {ai?.status === "done" && (
              <div className="mt-2">
                <div className="text-[10px] uppercase tracking-wider text-[#c084fc]">AI-generated — verify{ai.model ? ` · ${ai.model}` : ""}</div>
                {ai.summary && <p className="mt-1 text-[12px] text-[#e9d5ff]">{ai.summary}</p>}
                <div className="mt-1 text-[10px] text-muted">Grounding sources: {(ai.sources ?? []).map((s, i) => <a key={i} href={s.url} {...A} className="mr-2 underline">{s.label}</a>)} + the recorded Wikidata links listed above</div>
              </div>
            )}
              </>
            )}
          </div>
        </Section>

        <RelatedNews id={ev.id} />

        <Section title={`Connections (${links.length})`} hint="From Wikidata relations">
          {groups.size === 0 && <p className="text-[12px] text-muted">No recorded links in Wikidata between this event and others in the dataset.</p>}
          {[...groups.values()].map((g) => (
            <div key={g.kind + g.title} className="mb-3">
              <div className="mb-1 text-[11px] font-medium" style={{ color: EDGE_META[g.kind].color }}>{g.title}</div>
              <ul className="space-y-0.5">{g.items.slice(0, 20).map(({ o, via }) => <Row key={o.id + (via ?? "")} data={data} o={o} note={via} onClick={() => go(o.id)} />)}</ul>
            </div>
          ))}
        </Section>
        <Section title="Meanwhile elsewhere" hint="Overlapping in time, other regions">
          <ul className="space-y-0.5">{conc.map((o) => <Row key={o.id} data={data} o={o} note={data.meta.regions.find((r) => r.id === o.r)?.label} onClick={() => go(o.id)} />)}</ul>
        </Section>
        <Section title="Echoes across history" hint={`Other ${(rel?.label ?? cat?.label ?? "").toLowerCase()}`}>
          <ul className="space-y-0.5">{echoes.map((o) => <Row key={o.id} data={data} o={o} onClick={() => go(o.id)} />)}</ul>
        </Section>

        <Section title="Sources" hint="All references for this event">
          <ol className="list-decimal space-y-1.5 pl-4 text-[12px] marker:text-muted">
            {ev.w && <li><a href={wikiRevUrl(ev.w, ev.xr)} {...A} className="text-gold hover:underline">Wikipedia — “{ev.w}”{ev.xr ? `, revision ${ev.xr}` : ""}</a> <a href={wikiUrl(ev.w)} {...A} className="text-[10px] text-muted underline">current</a> <span className="text-[10px] text-muted">CC BY-SA 4.0</span></li>}
            <li><a href={wdUrl(ev.id)} {...A} className="text-[#7cc4ff] hover:underline">Wikidata item {ev.id}</a> <span className="text-[10px] text-muted">CC0 — dates, place, class, relations</span></li>
            {(ev.src ?? []).map((s) => (
              <li key={s.url}><a href={s.url} {...A} className="break-all hover:text-gold hover:underline">{hostOf(s.url)}</a> <span className="text-[10px] text-muted">{s.kind === "described" ? "described at URL (Wikidata P973)" : "reference URL cited in Wikidata (P854)"}</span></li>
            ))}
            {texts.length > 0 && texts.map((t) => <li key={t.url}><a href={t.url} {...A} className="hover:text-gold hover:underline">{t.title}</a> <span className="text-[10px] text-muted">{t.licence}</span></li>)}
          </ol>
        </Section>
      </div>
    </motion.aside>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t border-line pt-4">
      <div className="mb-2 flex items-baseline justify-between"><h3 className="text-[12px] uppercase tracking-[.16em] text-white">{title}</h3><span className="text-[10px] text-muted">{hint}</span></div>
      {children}
    </section>
  );
}
function Row({ data, o, note, onClick }: { data: Dataset; o: EventItem; note?: string; onClick: () => void }) {
  return (
    <li className="group flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-white/5">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: data.colorOf(o) }} />
      <span className="min-w-0 flex-1">
        <button onClick={onClick} className="block text-left text-[13px] leading-snug group-hover:text-gold">{o.t}</button>
        <span className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted">{fmtRange(o.s, o.e, o.p)}{note ? ` · ${note}` : ""}<SourceLinks ev={o} className="font-sans opacity-70 group-hover:opacity-100" /></span>
      </span>
    </li>
  );
}
