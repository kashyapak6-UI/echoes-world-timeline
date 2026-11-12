"use client";
import Link from "next/link";

export function StaticUnavailablePage({ feature }: { feature: string }) {
  return (
    <main className="grain grid min-h-dvh place-items-center bg-ink px-5">
      <div className="max-w-lg">
        <Link href="/" className="font-display text-2xl italic text-gold">Echoes</Link>
        <h1 className="mt-8 font-display text-5xl leading-none">{feature}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          This feature needs the full Echoes server — accounts, encrypted AI keys, and live news APIs.
          It isn’t available on this static GitHub Pages demo. Run the project locally with{" "}
          <code className="text-white">npm run dev -- -p 3010</code> to use it.
        </p>
        <Link href="/explore" className="mt-8 inline-block rounded-full bg-gold px-6 py-3 font-medium text-ink">
          Back to the timeline
        </Link>
      </div>
    </main>
  );
}

export function StaticNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-[12px] leading-relaxed text-[#f3dfb4]">
      {children}
    </p>
  );
}
