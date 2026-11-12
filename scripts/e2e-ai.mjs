// End-to-end test of accounts + server-side AI keys against the local mock (scripts/mock-openai.mjs).
// Usage: server on :3010 started with ECHOES_ALLOW_PRIVATE_BASEURL=1, mock on :3999. node scripts/e2e-ai.mjs
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:3010";
const KEY = "sk-test-FAKE-KEY-0123456789-wxyz";
const all = []; // every response body, to prove the key never comes back
let cookie = "";
const results = [];
const check = (name, ok, info = "") => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? ` — ${info}` : ""}`); };
async function call(path, { method = "GET", body, origin = BASE, raw = false } = {}) {
  const res = await fetch(BASE + path, { method, headers: { "content-type": "application/json", origin, ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0].endsWith("=") ? "" : sc.split(";")[0];
  if (raw) return res;
  const text = await res.text(); all.push(text);
  let j = null; try { j = JSON.parse(text); } catch { /* ndjson */ }
  return { status: res.status, j, text, setCookie: sc };
}

const email = `test+${Date.now()}@example.com`;
let r = await call("/api/auth/me"); check("anonymous /me is null", r.j.user === null);
r = await call("/api/auth/signup", { method: "POST", body: { email, password: "short" } }); check("signup rejects short password", r.status === 400);
r = await call("/api/auth/signup", { method: "POST", body: { email, password: "correct horse battery", name: "Test User" } });
check("signup creates account + session", r.status === 201 && !!cookie, `cookie flags: ${r.setCookie?.split(";").slice(1).map((s) => s.trim().split("=")[0]).join(", ")}`);
check("session cookie is HttpOnly + SameSite=Lax", /HttpOnly/.test(r.setCookie) && /SameSite=Lax/.test(r.setCookie));
r = await call("/api/profile/key", { method: "POST", origin: "https://evil.example", body: { provider: "custom", apiKey: KEY, model: "mock-1", baseUrl: "http://localhost:3999/v1" } });
check("cross-origin POST blocked", r.status === 403);
r = await call("/api/profile/key", { method: "POST", body: { provider: "custom", apiKey: KEY, model: "mock-1", baseUrl: "http://localhost:3999/v1" } });
check("save key (custom OpenAI-compatible)", r.status === 200 && r.j.key.masked === "••••wxyz", `masked=${r.j.key?.masked}`);
r = await call("/api/profile/key"); check("GET key returns masked only", r.j.key.masked === "••••wxyz" && !JSON.stringify(r.j).includes("FAKE-KEY"));
r = await call("/api/profile/key/test", { method: "POST" }); check("test connection via server → mock", r.j.ok === true, r.j.message);
r = await call("/api/ai/impact", { method: "POST", body: { eventId: "Q129053", recorded: ["- India (event location): [wikidata] Took place in this country: India"] } });
check("Explain impact uses stored key", r.status === 200 && r.j.countries?.length === 2 && r.j.sources?.length >= 1, `${r.j.countries?.map((c) => c.country).join(", ")}; sources: ${r.j.sources?.map((s) => s.url).join(" ")}`);

// streaming chat
const t0 = Date.now();
const res = await call("/api/ai/chat", { method: "POST", body: { question: "What led to the partition of India?", live: true }, raw: true });
const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "", first = 0, deltas = 0, answer = "", sources = [], notes = [];
for (;;) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (!l) continue; const m = JSON.parse(l); if (m.t === "sources") { sources = m.sources; notes = m.notes; } if (m.t === "delta") { deltas++; if (!first) first = Date.now() - t0; answer += m.v; } if (m.t === "error") answer += ` ERROR ${m.error}`; } }
all.push(answer, JSON.stringify(sources));
check("chat streams NDJSON deltas", deltas > 5, `${deltas} deltas, first after ${first} ms, total ${Date.now() - t0} ms`);
const cited = [...answer.matchAll(/\[(\d+)\]/g)].map((m) => +m[1]);
check("chat answer cites sources that exist with URLs", cited.length > 0 && cited.every((n) => sources.find((s) => s.n === n && /^https?:\/\//.test(s.url))), `cited ${cited.join(",")}; ${sources.length} sources (${sources.filter((s) => s.kind === "event").length} events, ${sources.filter((s) => s.kind === "news").length} news)${notes.length ? `; notes: ${notes.join(" | ")}` : ""}`);
console.log("   answer:", answer.slice(0, 220));
console.log("   sources:", sources.slice(0, 4).map((s) => `[${s.n}] ${s.title} <${s.url}>`).join("\n            "));

// wrong key → sanitised failure
r = await call("/api/profile/key", { method: "POST", body: { provider: "custom", apiKey: "sk-bad-ABCDEFGH9999", model: "mock-1", baseUrl: "http://localhost:3999/v1" } });
r = await call("/api/profile/key/test", { method: "POST" }); check("bad key: test fails cleanly", r.status === 502 && r.j.ok === false && !r.text.includes("ABCDEFGH"), r.j.message);
r = await call("/api/profile/key", { method: "POST", body: { provider: "custom", apiKey: KEY, model: "mock-1", baseUrl: "http://localhost:3999/v1" } }); check("replace key", r.j.key?.masked === "••••wxyz");
r = await call("/api/profile/key", { method: "POST", body: { provider: "custom", apiKey: "", model: "mock-2", baseUrl: "http://localhost:3999/v1" } }); check("update model keeps stored key", r.j.key?.model === "mock-2" && r.j.key?.masked === "••••wxyz");

// storage at rest
const store = fs.readFileSync(".echoes-data/store.json", "utf8");
check("store has no plaintext key or password", !store.includes(KEY) && !store.includes("FAKE-KEY") && !store.includes("correct horse"));
const u = Object.values(JSON.parse(store).users).find((x) => x.email === email);
check("stored key is AES-256-GCM sealed (iv/tag/ct) + last4", !!(u.key.iv && u.key.tag && u.key.ct && u.key.last4 === "wxyz"), `iv ${Buffer.from(u.key.iv, "base64").length} B, tag ${Buffer.from(u.key.tag, "base64").length} B`);
check("password stored as scrypt hash", u.pw.startsWith("scrypt$16384$8$1$"));
check(".env.local has auto-generated ECHOES_SECRET", /^ECHOES_SECRET=[0-9a-f]{64}$/m.test(fs.readFileSync(".env.local", "utf8")));

// delete + auth flows
r = await call("/api/profile/key", { method: "DELETE" }); check("delete key", r.j.key === null);
r = await call("/api/ai/chat", { method: "POST", body: { question: "x" } }); check("chat without key → 400", r.status === 400);
r = await call("/api/auth/logout", { method: "POST" }); r = await call("/api/auth/me"); check("logout clears session", r.j.user === null);
r = await call("/api/ai/impact", { method: "POST", body: { eventId: "Q129053" } }); check("AI without session → 401", r.status === 401);
r = await call("/api/auth/login", { method: "POST", body: { email, password: "wrong password!!" } }); check("wrong password → 401", r.status === 401);
r = await call("/api/auth/login", { method: "POST", body: { email, password: "correct horse battery" } }); check("login works", r.status === 200 && r.j.user.email === email);
check("full key never appeared in ANY response", !all.some((t) => t.includes(KEY) || t.includes("FAKE-KEY")));
const pass = results.filter((x) => x.ok).length;
console.log(`\n${pass}/${results.length} passed`);
fs.writeFileSync("scripts/e2e-ai-results.json", JSON.stringify({ at: new Date().toISOString(), pass, total: results.length, results }, null, 1));
process.exit(pass === results.length ? 0 : 1);
