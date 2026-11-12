import { currentUser, publicUser } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const u = currentUser(req);
  return json({ user: u ? publicUser(u) : null });
}
