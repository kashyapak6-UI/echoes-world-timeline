import { keyedStatus } from "@/lib/server/live";
import { json } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Which optional keyed news APIs are configured on the server (never returns the keys themselves).
export async function GET() { return json({ keyed: keyedStatus() }); }
