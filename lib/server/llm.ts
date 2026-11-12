import "server-only";
import { open } from "./secret";
import type { User } from "./store";
import { providerById } from "@/lib/providers";

export type Msg = { role: "system" | "user" | "assistant"; content: string };
type Cfg = { provider: string; baseUrl: string; model: string; apiKey: string };

/** Decrypt the user's key server-side. The plaintext never leaves the server. */
export function userLLM(u: User): Cfg | null {
  if (!u.key) return null;
  return { provider: u.key.provider, baseUrl: u.key.baseUrl, model: u.key.model, apiKey: open(u.key, u.id) };
}

/** Block private / loopback hosts for custom base URLs unless explicitly allowed (SSRF guard). */
export function checkBaseUrl(raw: string): string {
  const u = new URL(raw);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Base URL must be http(s)");
  const h = u.hostname.toLowerCase();
  const priv = h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd])/.test(h);
  if (priv && process.env.ECHOES_ALLOW_PRIVATE_BASEURL !== "1") throw new Error("Private/local base URLs are disabled (set ECHOES_ALLOW_PRIVATE_BASEURL=1 for local models)");
  if (u.protocol === "http:" && !priv) throw new Error("Use https for remote endpoints");
  return raw.replace(/\/+$/, "");
}

function request(cfg: Cfg, messages: Msg[], stream: boolean, maxTokens: number) {
  if (cfg.provider === "anthropic") {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    return fetch(`${cfg.baseUrl}/messages`, {
      method: "POST", signal: AbortSignal.timeout(90_000),
      headers: { "content-type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, system, stream, messages: messages.filter((m) => m.role !== "system") }),
    });
  }
  const headers: Record<string, string> = { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` };
  if (cfg.provider === "openrouter") { headers["HTTP-Referer"] = process.env.ECHOES_PUBLIC_URL || "http://localhost:3010"; headers["X-Title"] = "Echoes"; }
  return fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST", signal: AbortSignal.timeout(90_000), headers,
    body: JSON.stringify({ model: cfg.model, messages, stream, max_tokens: maxTokens, temperature: 0.2 }),
  });
}
/** Never echo provider error bodies verbatim (they can contain parts of the key); keep status + short message. */
async function failure(res: Response) {
  let msg = "";
  try { const j = await res.json(); msg = j?.error?.message ?? j?.error?.type ?? j?.message ?? ""; } catch { /* ignore */ }
  msg = String(msg).replace(/(sk|key|xai|AIza)[-_A-Za-z0-9]{6,}/g, "[redacted]").slice(0, 200);
  return new Error(`Provider returned HTTP ${res.status}${msg ? `: ${msg}` : ""}`);
}

export async function complete(cfg: Cfg, messages: Msg[], maxTokens = 800): Promise<string> {
  const res = await request(cfg, messages, false, maxTokens);
  if (!res.ok) throw await failure(res);
  const j = await res.json();
  return cfg.provider === "anthropic" ? (j.content ?? []).map((c: { text?: string }) => c.text ?? "").join("") : j.choices?.[0]?.message?.content ?? "";
}

/** Streams text deltas from either an OpenAI-compatible or Anthropic SSE stream. */
export async function* streamText(cfg: Cfg, messages: Msg[], maxTokens = 900): AsyncGenerator<string> {
  const res = await request(cfg, messages, true, maxTokens);
  if (!res.ok) throw await failure(res);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("event-stream")) { // provider ignored stream=true
    const j = await res.json();
    yield cfg.provider === "anthropic" ? (j.content ?? []).map((c: { text?: string }) => c.text ?? "").join("") : j.choices?.[0]?.message?.content ?? "";
    return;
  }
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const j = JSON.parse(data);
        const t = cfg.provider === "anthropic" ? (j.type === "content_block_delta" ? j.delta?.text : "") : j.choices?.[0]?.delta?.content;
        if (t) yield t;
      } catch { /* partial / keep-alive */ }
    }
  }
}
export const providerLabel = (id: string) => providerById(id)?.label ?? id;
