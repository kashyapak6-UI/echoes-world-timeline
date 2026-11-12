// Tiny local mock of an OpenAI-compatible /v1/chat/completions endpoint, for testing the full AI round trip.
// Usage: node scripts/mock-openai.mjs  (port 3999). Logs which key arrived (last 4 only).
import http from "node:http";
const PORT = Number(process.env.MOCK_PORT || 3999);
export const seen = [];
http.createServer((req, res) => {
  if (req.method !== "POST" || !req.url.endsWith("/chat/completions")) { res.writeHead(404); return res.end("not found"); }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const auth = req.headers.authorization ?? "";
    const key = auth.replace(/^Bearer /, "");
    console.log(`[mock] ${new Date().toISOString()} auth=Bearer …${key.slice(-4)} len=${key.length}`);
    if (!key.startsWith("sk-test-")) { res.writeHead(401, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: { message: "invalid api key" } })); }
    const j = JSON.parse(body);
    const last = j.messages.at(-1).content;
    let content;
    if (/Reply with the single word/.test(last)) content = "ok";
    else if (/Reply with JSON only/.test(last)) content = JSON.stringify({ summary: "MOCK: grounded summary from the mock model.", countries: [{ country: "India", social: "MOCK social effect", economic: "unknown", political: "MOCK political effect" }, { country: "Pakistan", social: "MOCK displacement", economic: "MOCK trade disruption", political: "unknown" }] });
    else {
      const srcs = [...last.matchAll(/^\[(\d+)\] \(([^)]*)\) (.+)$/gm)].slice(0, 3);
      content = srcs.length
        ? `MOCK ANSWER. ${srcs.map((m) => `${m[3].slice(0, 80)} is covered in source [${m[1]}].`).join(" ")} This text comes from the local mock model, not a real AI.`
        : "MOCK ANSWER: the sources do not cover this.";
    }
    if (!j.stream) { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content } }] })); }
    res.writeHead(200, { "content-type": "text/event-stream" });
    const words = content.split(/(?<= )/);
    let i = 0;
    const iv = setInterval(() => {
      if (i < words.length) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: words[i++] } }] })}\n\n`);
      else { res.write("data: [DONE]\n\n"); clearInterval(iv); res.end(); }
    }, 25);
  });
}).listen(PORT, () => console.log(`[mock] OpenAI-compatible mock on http://localhost:${PORT}/v1`));
