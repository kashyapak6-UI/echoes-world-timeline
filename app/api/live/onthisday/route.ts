import { onThisDay } from "@/lib/server/live";
import { json } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const t = new Date();
  const m = Math.min(12, Math.max(1, Number(sp.get("m")) || t.getMonth() + 1));
  const d = Math.min(31, Math.max(1, Number(sp.get("d")) || t.getDate()));
  return json({ month: m, day: d, ...(await onThisDay(m, d)) });
}
