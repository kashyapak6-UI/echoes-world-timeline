import { keyedNews } from "@/lib/server/live";
import { json } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const p = sp.get("provider");
  if (p !== "newsdata" && p !== "currents" && p !== "guardian") return json({ error: "Unknown provider" }, 400);
  return json(await keyedNews(p, (sp.get("q") ?? "").trim().slice(0, 120)));
}
