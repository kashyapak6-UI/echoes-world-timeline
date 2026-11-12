"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { PROVIDERS, providerById } from "@/lib/providers";
import { useMe } from "@/lib/useMe";
import { isStaticExport } from "@/lib/config";
import { StaticUnavailablePage } from "./StaticUnavailable";

export function ProfileView() {
  const router = useRouter();
  const { user, loaded, set, refresh } = useMe();
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState(PROVIDERS[0].model);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (isStaticExport) return; if (loaded && !user) router.replace("/login?next=/profile"); }, [loaded, user, router]);
  useEffect(() => { if (user?.key) { setProvider(user.key.provider); setModel(user.key.model); setBaseUrl(user.key.provider === "custom" ? user.key.baseUrl : ""); } }, [user?.key]);
  if (isStaticExport) return <StaticUnavailablePage feature="Profile" />;
  if (!user) return <main className="grid min-h-dvh place-items-center bg-ink text-muted">Loading…</main>;
  const p = providerById(provider)!;
  const k = user.key;

  const call = async (what: string, url: string, init: RequestInit) => {
    setBusy(what); setMsg(null);
    try {
      const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
      const j = await res.json();
      if (!res.ok && what !== "test") { setMsg({ ok: false, text: j.error ?? `HTTP ${res.status}` }); return; }
      if (what === "test") setMsg({ ok: !!j.ok, text: j.message ?? j.error });
      if (what === "save") { setApiKey(""); setMsg({ ok: true, text: "Saved. The key is encrypted on the server; only its last 4 characters are shown." }); }
      if (what === "delete") setMsg({ ok: true, text: "Key deleted from the server." });
      await refresh();
    } finally { setBusy(null); }
  };
  const field = "mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-white outline-none focus:border-gold/60";
  return (
    <main className="grain min-h-dvh bg-ink">
      <header className="flex h-14 items-center gap-4 border-b border-line px-5">
        <Link href="/" className="font-display text-2xl italic text-gold">Echoes</Link>
        <Link href="/explore" className="text-sm text-muted hover:text-white">Explore</Link>
        <Link href="/ask" className="text-sm text-muted hover:text-white">Ask Echoes</Link>
        <div className="flex-1" />
        <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); set(null); router.push("/"); }} className="text-sm text-muted hover:text-white">Sign out</button>
      </header>
      <div className="mx-auto max-w-2xl px-5 py-10">
        <p className="text-[11px] uppercase tracking-[.2em] text-gold">Profile</p>
        <h1 className="mt-1 font-display text-5xl leading-none">{user.name ?? user.email}</h1>
        <p className="mt-2 text-[13px] text-muted">{user.email} · member since {new Date(user.createdAt).toLocaleDateString()}</p>

        <section className="mt-8 rounded-2xl border border-line bg-panel/60 p-6">
          <h2 className="flex items-center gap-2 text-lg"><KeyRound size={18} className="text-[#c084fc]" /> AI provider</h2>
          <p className="mt-1 flex items-start gap-2 text-[12px] text-muted"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#7cf5c4]" />
            Your key is sent once over this connection, encrypted on the server with AES-256-GCM, and never returned to any browser — not even this one. Only the last 4 characters are shown. Ask Echoes and Explain impact call the provider from the server.</p>

          {k && (
            <div className="mt-5 rounded-xl border border-line bg-black/20 p-4 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><span className="text-white">{providerById(k.provider)?.label ?? k.provider}</span> · <span className="font-mono">{k.model}</span></div>
                <span className="font-mono text-[13px] tracking-wider text-gold" aria-label="Masked key">{k.masked}</span>
              </div>
              {k.provider === "custom" && <div className="mt-1 break-all font-mono text-[11px] text-muted">{k.baseUrl}</div>}
              <div className="mt-2 flex items-center gap-1.5 text-[12px]">
                {k.testOk === true && <><CheckCircle2 size={13} className="text-[#7cf5c4]" /><span className="text-[#bff5df]">{k.testMsg}</span></>}
                {k.testOk === false && <><XCircle size={13} className="text-red-300" /><span className="text-red-200">{k.testMsg}</span></>}
                {k.testOk == null && <span className="text-muted">Not tested yet</span>}
                {k.testedAt && <span className="ml-auto text-[10px] text-muted">{new Date(k.testedAt).toLocaleString()}</span>}
              </div>
              <div className="mt-3 flex gap-2">
                <button disabled={!!busy} onClick={() => call("test", "/api/profile/key/test", { method: "POST" })} className="rounded-full border border-line px-3 py-1 text-[12px] hover:border-gold/50 disabled:opacity-50">{busy === "test" ? "Testing…" : "Test connection"}</button>
                <button disabled={!!busy} onClick={() => confirm("Delete the stored key?") && call("delete", "/api/profile/key", { method: "DELETE" })} className="flex items-center gap-1 rounded-full border border-red-400/30 px-3 py-1 text-[12px] text-red-200 hover:bg-red-400/10 disabled:opacity-50"><Trash2 size={12} /> Delete</button>
              </div>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); call("save", "/api/profile/key", { method: "POST", body: JSON.stringify({ provider, model, baseUrl, apiKey }) }); }} className="mt-6">
            <h3 className="text-[12px] uppercase tracking-[.16em] text-muted">{k ? "Replace or update" : "Connect a provider"}</h3>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PROVIDERS.map((x) => (
                <button type="button" key={x.id} onClick={() => { setProvider(x.id); setModel(k?.provider === x.id ? k.model : x.model); }}
                  className={`rounded-lg border px-3 py-2 text-left text-[13px] ${provider === x.id ? "border-gold/70 bg-gold/10 text-white" : "border-line text-muted hover:text-white"}`}>{x.label}</button>
              ))}
            </div>
            {p.note && <p className="mt-2 text-[11px] text-muted">{p.note}</p>}
            {provider === "custom" && <label className="mt-4 block text-[12px] text-muted">Base URL (must serve /chat/completions)<input className={field} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" required /></label>}
            <label className="mt-4 block text-[12px] text-muted">Model<input className={field} value={model} onChange={(e) => setModel(e.target.value)} required /></label>
            <label className="mt-4 block text-[12px] text-muted">API key {k?.provider === provider && <span>(leave empty to keep the stored key)</span>}
              <input className={field} type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" placeholder={k?.provider === provider ? k.masked : "Paste your key"} required={!(k?.provider === provider)} />
            </label>
            {p.keyUrl && <p className="mt-1 text-[11px] text-muted">Get a key: <a className="underline" href={p.keyUrl} target="_blank" rel="noopener noreferrer">{p.keyUrl}</a></p>}
            <button disabled={!!busy} className="mt-5 rounded-full bg-gold px-5 py-2 text-sm font-medium text-ink disabled:opacity-50">{busy === "save" ? "Saving…" : k ? "Save changes" : "Save key"}</button>
          </form>
          {msg && <p role="status" className={`mt-4 rounded-md border px-3 py-2 text-[12px] ${msg.ok ? "border-[#7cf5c4]/30 bg-[#7cf5c4]/10 text-[#bff5df]" : "border-red-400/30 bg-red-400/10 text-red-200"}`}>{msg.text}</p>}
        </section>
      </div>
    </main>
  );
}
