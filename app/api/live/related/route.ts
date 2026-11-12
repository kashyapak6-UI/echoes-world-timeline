import { dataset } from "@/lib/server/dataset";
import { gdeltNews, keyedNews, keyedStatus } from "@/lib/server/live";
import { json } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// "Related live news" for one dataset event: GDELT (last 3 months, exact-phrase title) + The Guardian archive if configured.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const ev = dataset().byId.get(id);
  if (!ev) return json({ error: "Unknown event" }, 404);
  const title = ev.t.replace(/[“”"()]/g, "").replace(/\s+/g, " ").trim();
  const phrase = title.split(" ").length > 1 ? `"${title}"` : title;
  const gdelt = await gdeltNews(`${phrase} sourcelang:english`, "3m", 12);
  const guardianOn = keyedStatus().find((k) => k.id === "guardian")?.configured;
  const guardian = guardianOn ? await keyedNews("guardian", title) : null;
  return json({ query: phrase, results: [gdelt, ...(guardian ? [guardian] : [])] });
}
