import { currentUser, publicUser, sameOrigin } from "@/lib/server/auth";
import { seal } from "@/lib/server/secret";
import { write } from "@/lib/server/store";
import { checkBaseUrl } from "@/lib/server/llm";
import { body, json } from "@/lib/server/http";
import { providerById } from "@/lib/providers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = currentUser(req); if (!u) return json({ error: "Sign in first" }, 401);
  return json({ key: publicUser(u).key });
}
/** Save or replace the key. The key is encrypted immediately; only the last 4 characters are kept in clear. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
  const u = currentUser(req); if (!u) return json({ error: "Sign in first" }, 401);
  const b = await body<{ provider: string; apiKey: string; model: string; baseUrl: string }>(req);
  const p = providerById(String(b.provider));
  if (!p) return json({ error: "Unknown provider" }, 400);
  const apiKey = String(b.apiKey ?? "").trim();
  const keep = !apiKey && u.key && u.key.provider === p.id; // allow changing model/base URL without re-entering the key
  if (!keep && (apiKey.length < 8 || apiKey.length > 400 || /\s/.test(apiKey))) return json({ error: "Paste a valid API key" }, 400);
  const model = String(b.model ?? p.model).trim().slice(0, 120);
  if (!model) return json({ error: "Model is required" }, 400);
  let baseUrl = p.baseUrl;
  if (p.id === "custom") { try { baseUrl = checkBaseUrl(String(b.baseUrl ?? "")); } catch (e) { return json({ error: (e as Error).message }, 400); } }
  const sealed = keep ? { iv: u.key!.iv, tag: u.key!.tag, ct: u.key!.ct } : seal(apiKey, u.id);
  const last4 = keep ? u.key!.last4 : apiKey.slice(-4);
  const updated = await write((d) => {
    d.users[u.id].key = { ...sealed, provider: p.id, model, baseUrl, last4, updatedAt: new Date().toISOString() };
    return d.users[u.id];
  });
  return json({ key: publicUser(updated).key });
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
  const u = currentUser(req); if (!u) return json({ error: "Sign in first" }, 401);
  await write((d) => { delete d.users[u.id].key; });
  return json({ key: null });
}
