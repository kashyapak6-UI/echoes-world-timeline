import { clientIp, createSession, limited, publicUser, sameOrigin, sessionCookie, verifyPassword } from "@/lib/server/auth";
import { read } from "@/lib/server/store";
import { body, json } from "@/lib/server/http";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
  const b = await body<{ email: string; password: string }>(req);
  const email = String(b.email ?? "").trim().toLowerCase();
  if (limited(`login:${clientIp(req)}:${email}`, 8)) return json({ error: "Too many attempts, try again in a few minutes" }, 429);
  const user = read((d) => Object.values(d.users).find((u) => u.email === email));
  // verify against a dummy hash when the user does not exist, to keep timing similar
  const ok = await verifyPassword(String(b.password ?? ""), user?.pw ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==");
  if (!user || !ok) return json({ error: "Wrong email or password" }, 401);
  const s = await createSession(user.id);
  return json({ user: publicUser(user) }, 200, { "set-cookie": sessionCookie(req, s.token, s.expires) });
}
