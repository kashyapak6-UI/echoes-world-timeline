import { currentUser, publicUser, sameOrigin } from "@/lib/server/auth";
import { write } from "@/lib/server/store";
import { complete, userLLM } from "@/lib/server/llm";
import { json } from "@/lib/server/http";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
  const u = currentUser(req); if (!u) return json({ error: "Sign in first" }, 401);
  const cfg = userLLM(u); if (!cfg) return json({ error: "No key connected" }, 400);
  let ok = false, msg = "";
  try {
    const out = await complete(cfg, [{ role: "user", content: "Reply with the single word: ok" }], 10);
    ok = true; msg = `Connected — model replied “${out.trim().slice(0, 40)}”`;
  } catch (e) { msg = (e as Error).message; }
  const updated = await write((d) => { Object.assign(d.users[u.id].key!, { testedAt: new Date().toISOString(), testOk: ok, testMsg: msg }); return d.users[u.id]; });
  return json({ ok, message: msg, key: publicUser(updated).key }, ok ? 200 : 502);
}
