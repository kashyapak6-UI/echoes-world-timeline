"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useMeStore } from "@/lib/useMe";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/profile";
  const setMe = useMeStore((s) => s.set);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, name }) });
      const j = await res.json();
      if (!res.ok) { setErr(j.error ?? "Something went wrong"); return; }
      setMe(j.user);
      router.push(next.startsWith("/") ? next : "/profile");
    } finally { setBusy(false); }
  };
  const field = "mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-sm text-white outline-none focus:border-gold/60";
  return (
    <main className="grain grid min-h-dvh place-items-center bg-ink px-5">
      <form onSubmit={submit} className="glass w-full max-w-sm rounded-2xl p-7">
        <Link href="/" className="font-display text-2xl italic text-gold">Echoes</Link>
        <h1 className="mt-4 font-display text-4xl leading-none">{mode === "login" ? "Welcome back" : "Create your profile"}</h1>
        <p className="mt-2 text-[13px] text-muted">{mode === "login" ? "Sign in to use Ask Echoes and Explain impact with your own AI provider." : "A profile lets you connect your own AI provider. Your key is encrypted on the server and never sent back to the browser."}</p>
        {mode === "signup" && <label className="mt-5 block text-[12px] text-muted">Name (optional)<input className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>}
        <label className="mt-4 block text-[12px] text-muted">Email<input className={field} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label className="mt-4 block text-[12px] text-muted">Password{mode === "signup" && " (10+ characters)"}<input className={field} type="password" required minLength={mode === "signup" ? 10 : 1} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {err && <p className="mt-3 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-[12px] text-red-200" role="alert">{err}</p>}
        <button disabled={busy} className="mt-6 w-full rounded-full bg-gold py-2.5 text-sm font-medium text-ink disabled:opacity-50">{busy ? "…" : mode === "login" ? "Sign in" : "Create profile"}</button>
        <p className="mt-4 text-center text-[12px] text-muted">
          {mode === "login" ? <>New here? <Link className="text-gold underline" href={`/signup?next=${encodeURIComponent(next)}`}>Create a profile</Link></> : <>Already have one? <Link className="text-gold underline" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></>}
        </p>
      </form>
    </main>
  );
}
