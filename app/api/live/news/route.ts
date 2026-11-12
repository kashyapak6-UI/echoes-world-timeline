import { DEFAULT_NEWS_QUERY, gdeltNews } from "@/lib/server/live";
import { json } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 200);
  const timespan = /^\d{1,3}(h|d|w|m)$/.test(sp.get("timespan") ?? "") ? sp.get("timespan")! : "1d";
  return json(await gdeltNews(q ? `${q} sourcelang:english` : DEFAULT_NEWS_QUERY, timespan, 75));
}
