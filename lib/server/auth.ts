import "server-only";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { read, write, type User } from "./store";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const COOKIE = "echoes_session";
const SESSION_DAYS = 30;

export async function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(pw.normalize("NFKC"), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${h.toString("base64")}`;
}
export async function verifyPassword(pw: string, stored: string) {
  const [alg, N, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt") return false;
  const h = await scrypt(pw.normalize("NFKC"), Buffer.from(salt, "base64"), 64, { N: +N, r: +r, p: +p, maxmem: SCRYPT.maxmem });
  const want = Buffer.from(hash, "base64");
  return want.length === h.length && crypto.timingSafeEqual(want, h);
}
const tokenHash = (t: string) => crypto.createHash("sha256").update(t).digest("base64url");

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = Date.now() + SESSION_DAYS * 864e5;
  await write((d) => {
    for (const [k, s] of Object.entries(d.sessions)) if (s.expires < Date.now()) delete d.sessions[k];
    d.sessions[tokenHash(token)] = { userId, expires };
  });
  return { token, expires };
}
export async function destroySession(token: string | undefined) {
  if (token) await write((d) => { delete d.sessions[tokenHash(token)]; });
}
function cookieValue(req: Request, name: string) {
  const c = req.headers.get("cookie") ?? "";
  for (const part of c.split(/;\s*/)) { const i = part.indexOf("="); if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1)); }
  return undefined;
}
export const sessionToken = (req: Request) => cookieValue(req, COOKIE);
export function currentUser(req: Request): User | null {
  const t = sessionToken(req); if (!t) return null;
  return read((d) => { const s = d.sessions[tokenHash(t)]; return s && s.expires > Date.now() ? d.users[s.userId] ?? null : null; });
}
export function sessionCookie(req: Request, token: string, expires: number) {
  const secure = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expires).toUTCString()}${secure ? "; Secure" : ""}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

/** Reject cross-site state-changing requests (defence in depth on top of SameSite=Lax). */
export function sameOrigin(req: Request) {
  const o = req.headers.get("origin");
  if (!o) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try { return new URL(o).host === host; } catch { return false; }
}
/** Public view of a user — never includes the password hash or key material. */
export function publicUser(u: User) {
  return { id: u.id, email: u.email, name: u.name ?? null, createdAt: u.createdAt,
    key: u.key ? { provider: u.key.provider, model: u.key.model, baseUrl: u.key.baseUrl, masked: `••••${u.key.last4}`, updatedAt: u.key.updatedAt, testedAt: u.key.testedAt ?? null, testOk: u.key.testOk ?? null, testMsg: u.key.testMsg ?? null } : null };
}
// tiny in-memory limiter for login / signup attempts
const hits = new Map<string, number[]>();
export function limited(key: string, max = 10, windowMs = 10 * 60_000) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  return arr.length > max;
}
export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
