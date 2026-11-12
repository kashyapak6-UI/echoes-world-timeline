import { usgsQuakes } from "@/lib/server/live";
import { json } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  return json(await usgsQuakes(new URL(req.url).searchParams.get("feed") ?? "4.5_week"));
}
