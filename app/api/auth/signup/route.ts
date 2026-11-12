import crypto from "node:crypto";
import { clientIp, createSession, hashPassword, limited, publicUser, sameOrigin, sessionCookie } from "@/lib/server/auth";
import { read, write } from "@/lib/server/store";
import { body, json } from "@/lib/server/http";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
  if (limited(`signup:${clientIp(req)}`, 8)) return json({ error: "Too many attempts, try again later" }, 429);
  const b = await body<{ email: string; password: string; name: string }>(req);
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return json({ error: "Enter a valid email" }, 400);
  if (password.length < 10 || password.length > 200) return json({ error: "Password must be 10–200 characters" }, 400);
  if (read((d) => Object.values(d.users).some((u) => u.email === email))) return json({ error: "An account with this email already exists" }, 409);
  const user = { id: crypto.randomUUID(), email, name: String(b.name ?? "").trim().slice(0, 80) || undefined, pw: await hashPassword(password), createdAt: new Date().toISOString() };
  await write((d) => { d.users[user.id] = user; });
  const s = await createSession(user.id);
  return json({ user: publicUser(user) }, 201, { "set-cookie": sessionCookie(req, s.token, s.expires) });
}
