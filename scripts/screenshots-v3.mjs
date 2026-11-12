// v3 shots: live view, map live layers, signup/profile, Ask Echoes with citations, server-side Explain impact.
// Needs the mock (node scripts/mock-openai.mjs) and the server started with ECHOES_ALLOW_PRIVATE_BASEURL=1.
import { createRequire } from "node:module";
const require = createRequire("/workspace/websites/_tools/package.json");
const { chromium } = require("playwright-core");
const OUT = new URL("../screenshots/", import.meta.url).pathname;
const BASE = process.env.BASE || "http://localhost:3010";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 960 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const logs = [];
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
const shot = async (name) => { await page.screenshot({ path: OUT + name }); console.log("saved", name); };
const wait = (ms) => page.waitForTimeout(ms);

// signup
await page.goto(BASE + "/signup?next=/profile", { waitUntil: "networkidle" });
await page.getByLabel("Name (optional)").fill("Amit (demo)");
await page.getByLabel("Email").fill(`demo+${Date.now()}@example.com`);
await page.getByLabel(/Password/).fill("demo password 2026");
await shot("29-signup.png");
await page.getByRole("button", { name: "Create profile" }).click();
await page.waitForURL("**/profile");
await wait(1000);
// connect provider (custom → local mock), save, test
await page.getByRole("button", { name: "Other (OpenAI-compatible)" }).click();
await page.getByLabel(/Base URL/).fill("http://localhost:3999/v1");
await page.getByLabel("Model").fill("mock-1");
await page.getByLabel(/API key/).fill("sk-test-DEMO-KEY-1234abcd");
await page.getByRole("button", { name: "Save key" }).click();
await wait(1500);
await page.getByRole("button", { name: "Test connection" }).click();
await wait(2500);
await shot("30-profile-key-connected.png");

// Ask Echoes
await page.goto(BASE + "/ask", { waitUntil: "networkidle" });
await wait(800);
await page.getByLabel("Question").fill("What led to the partition of India and what followed?");
await page.keyboard.press("Enter");
await page.waitForFunction(() => document.body.innerText.includes("not a real AI"), null, { timeout: 120_000 }).catch(() => {});
await wait(1500);
await shot("31-ask-echoes-answer-citations.png");

// Explain impact (server-side key) + related live news
await page.goto(BASE + "/explore?event=Q129053", { waitUntil: "networkidle" });
await wait(2500);
await page.getByRole("button", { name: /Explain impact/ }).click();
await page.waitForFunction(() => document.body.innerText.includes("MOCK: grounded summary"), null, { timeout: 60_000 }).catch(() => {});
await page.locator("aside h3", { hasText: "Impact ripple" }).last().scrollIntoViewIfNeeded();
await page.locator("aside").last().evaluate((el) => el.scrollBy(0, 330));
await wait(800);
await shot("32-explain-impact-server-key.png");
await page.waitForFunction(() => !document.body.innerText.includes("Searching recent coverage"), null, { timeout: 120_000 }).catch(() => {});
await page.locator("aside h3", { hasText: "Related live news" }).last().scrollIntoViewIfNeeded();
await wait(800);
await shot("33-related-live-news.png");

// Live view
await page.goto(BASE + "/explore?view=live", { waitUntil: "load" });
await page.waitForFunction(() => document.querySelectorAll("section ul li").length > 30 && document.querySelectorAll("section ol li").length > 5, null, { timeout: 120_000 }).catch(() => {});
await wait(2000);
await shot("34-live-view.png");

// Map live layers
await page.goto(BASE + "/explore?view=map", { waitUntil: "load" });
await wait(5000);
await page.getByLabel(/Earthquakes M4.5/).check();
await page.getByLabel(/News · 24 h/).check();
await wait(25000);
await shot("35-map-live-layers.png");
console.log(logs.join("\n") || "no page errors");
await browser.close();
