import { clearCookie, destroySession, sameOrigin, sessionToken } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
  await destroySession(sessionToken(req));
  return json({ ok: true }, 200, { "set-cookie": clearCookie() });
}
