// Usage: BASE=http://localhost:3010 node scripts/screenshots.mjs  (needs playwright-core from ../_tools)
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

await page.goto(BASE + "/", { waitUntil: "networkidle" });
await wait(9000);
await shot("01-landing-hero.png");
await page.evaluate(() => window.scrollTo(0, 1100));
await wait(2500);
await shot("02-landing-patterns-teaser.png");

await page.goto(BASE + "/explore", { waitUntil: "networkidle" });
await wait(2500);
await shot("03-timeline-overview.png");
await page.getByRole("button", { name: "Early modern" }).click();
await wait(1800);
await page.mouse.move(900, 400);
await wait(400);
await shot("04-timeline-early-modern.png");

await page.goto(BASE + "/explore?event=Q361", { waitUntil: "networkidle" }); // World War I
await wait(3000);
await shot("05-timeline-selected-connections.png");

// Map: zoomed out with clusters (whole span)
await page.goto(BASE + "/explore?view=map", { waitUntil: "load" });
await wait(2000);
await page.getByRole("button", { name: "All", exact: true }).click();
await wait(6000);
await shot("06-map-world-clusters.png");
// Scrub to the medieval window
await page.getByRole("button", { name: "Medieval" }).click();
await wait(4000);
await shot("07-map-medieval-window.png");
// zoom into Europe via search -> fly to an event, popup with connections
await page.getByRole("button", { name: "Modern", exact: true }).click();
await wait(1500);
await page.getByLabel("Search events").fill("Battle of Waterloo");
await wait(600);
await page.keyboard.press("Enter");
await wait(5000);
await shot("08-map-region-zoom-popup.png");
await page.locator(".maplibregl-popup-close-button").click().catch(() => {});
await page.getByRole("button", { name: "Zoom in" }).click();
await wait(900);
await page.getByRole("button", { name: "Zoom in" }).click();
await wait(4000);
await shot("09-map-region-closeup.png");
await page.keyboard.press("Escape");
await page.getByRole("button", { name: /Flat/ }).click();
await page.getByRole("button", { name: "All", exact: true }).click();
await wait(1000);
await page.mouse.move(800, 450);
for (let i = 0; i < 6; i++) { await page.getByRole("button", { name: "Zoom out" }).click(); await wait(400); }
await wait(5000);
await shot("10-map-globe.png");

await page.goto(BASE + "/explore?view=patterns", { waitUntil: "networkidle" });
await wait(2500);
await shot("11-patterns.png");
await page.goto(BASE + "/credits", { waitUntil: "networkidle" });
await wait(800);
await shot("12-credits.png");

const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mp = await m.newPage();
await mp.goto(BASE + "/", { waitUntil: "networkidle" });
await mp.waitForTimeout(6000);
await mp.screenshot({ path: OUT + "13-mobile-landing.png" });
console.log("saved 13-mobile-landing.png");
console.log(logs.slice(0, 30).join("\n") || "no console errors");
await browser.close();
