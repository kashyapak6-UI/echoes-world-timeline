// v2 shots: sources, impact ripple, religions. Usage: BASE=http://localhost:3010 node scripts/screenshots-v2.mjs
import { createRequire } from "node:module";
const require = createRequire("/workspace/websites/_tools/package.json");
const { chromium } = require("playwright-core");
const OUT = new URL("../screenshots/", import.meta.url).pathname;
const BASE = process.env.BASE || "http://localhost:3010";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 960 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => { if (m.type() === "error") logs.push(`[console] ${m.text()}`); });
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
const shot = async (name) => { await page.screenshot({ path: OUT + name }); console.log("saved", name); };
const wait = (ms) => page.waitForTimeout(ms);
const toSection = async (t) => { await page.locator("aside h3", { hasText: t }).last().scrollIntoViewIfNeeded(); await wait(700); };
const only = process.env.ONLY;

if (!only || only === "ripple") {
  // Partition of India — map ripple
  await page.goto(BASE + "/explore?view=map&event=Q129053", { waitUntil: "load" });
  await wait(9000);
  await page.locator(".maplibregl-popup-close-button").click().catch(() => {});
  await wait(1500);
  await shot("14-ripple-partition-of-india-map.png");
  // hover Pakistan to show "how affected"
  await page.mouse.move(660, 420); await wait(800);
  await toSection("Impact ripple");
  await shot("15-ripple-partition-of-india-detail.png");
  await page.goto(BASE + "/explore?event=Q129053", { waitUntil: "networkidle" });
  await wait(2500);
  await page.getByRole("button", { name: "Since 1945" }).click().catch(() => {});
  await wait(2000);
  await shot("16-ripple-partition-of-india-timeline.png");

  // World War I — map ripple
  await page.goto(BASE + "/explore?view=map&event=Q361", { waitUntil: "load" });
  await wait(9000);
  await page.locator(".maplibregl-popup-close-button").click().catch(() => {});
  await wait(1500);
  await shot("17-ripple-wwi-map.png");
  await toSection("Impact ripple");
  await shot("18-ripple-wwi-detail.png");
  await page.goto(BASE + "/explore?event=Q361", { waitUntil: "networkidle" });
  await wait(2500);
  await page.getByRole("button", { name: "Modern", exact: true }).click().catch(() => {});
  await wait(2000);
  await shot("19-ripple-wwi-timeline.png");
}

if (!only || only === "sources") {
  await page.goto(BASE + "/explore?event=Q361", { waitUntil: "networkidle" });
  await wait(2500);
  await toSection("Sources");
  await page.locator("aside").last().evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await wait(600);
  await shot("20-detail-sources-block.png");
  await page.goto(BASE + "/explore?view=map&event=Q48314", { waitUntil: "load" }); // Battle of Waterloo
  await wait(8000);
  await shot("21-map-popup-sources.png");
  await page.goto(BASE + "/explore", { waitUntil: "networkidle" });
  await wait(1500);
  await page.getByLabel("Search events").fill("plague");
  await wait(900);
  await shot("22-search-results-sources.png");
}

if (!only || only === "religion") {
  await page.goto(BASE + "/explore?view=religions", { waitUntil: "networkidle" });
  await wait(2500);
  await shot("23-religions-view.png");
  await page.locator("article").first().scrollIntoViewIfNeeded();
  await wait(1200);
  await shot("24-religions-cards.png");
  await page.goto(BASE + "/explore?view=religions&event=Q432", { waitUntil: "networkidle" }); // Islam (origin)
  await wait(2500);
  await shot("25-religion-detail-islam.png");
  await page.goto(BASE + "/explore?event=Q5043", { waitUntil: "networkidle" }); // Christianity
  await wait(1500);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Classical" }).click().catch(() => {});
  await wait(2000);
  await shot("26-timeline-religion-colours-classical.png");
  await page.goto(BASE + "/explore?view=patterns", { waitUntil: "networkidle" });
  await wait(2000);
  await page.getByText("Religions — origins, figures").scrollIntoViewIfNeeded();
  await wait(800);
  await shot("27-patterns-religion-rows.png");
  await page.goto(BASE + "/credits", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Religions" }).scrollIntoViewIfNeeded();
  await wait(800);
  await shot("28-credits-religion-texts.png");
}
console.log(logs.slice(0, 30).join("\n") || "no console errors");
await browser.close();
