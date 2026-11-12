# Echoes — a connected timeline & map of world history (v2)

Zoomable deep-time timeline + clustered world map + pattern explorer, built only from open data.

## Run
```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
```

Live demo (static GitHub Pages): https://kashyapak6-ui.github.io/echoes-world-timeline/

The Pages build (`npm run build:static`, used by `.github/workflows/pages.yml`) is a static export. Timeline, map, patterns, religions, sources and the Wikidata impact ripple all work there. Accounts, Ask Echoes, Explain impact (AI), Live news and earthquake layers need the local server above — they show a short note on the demo instead of erroring. `npm run dev` / `npm run build` are unchanged.

Data is already built into `public/data/`. To refresh it from the live sources (≈10 min):
```bash
rm -rf data/raw/ids-* data/raw/details.json data/raw/relations.json data/raw/external-labels.json data/raw/wikipedia-extracts.json
npm run data         # fetch.mjs + fetch-extra.mjs + fetch-religion.mjs + fetch-topup.mjs + build.mjs
```

## Pages
- `/` — landing: animated dot-globe (three.js / R3F) that lights up events in date order, GSAP + Lenis scroll, pattern teaser.
- `/explore` — the app (tabs: **Timeline**, **Map**, **Patterns**, **Religions**; keys T / M / P / R, Esc closes details). Deep links: `/explore?event=Q361`, `/explore?view=map`.
- `/credits` — sources, licences, method.

## Data pipeline (`data/`)
- `categories.mjs` — 16 pattern categories → Wikidata classes (instance of / subclass of*) + notability threshold (Wikipedia sitelinks).
- `fetch.mjs` — Wikidata SPARQL: candidate ids per class → details (label, description, dates with precision, coordinates, enwiki title) → relations
  (P828/P1542/P1478 cause-effect, P361/P527 part-of, P155/P156/P1365/P1366 sequence, P793 significant event, P710 participant, P17 country)
  → labels for participants → Wikipedia intro extracts (3 sentences). Cached in `data/raw/`.
- `build.mjs` — dates (WDQS astronomical years, precision kept), region from coordinates, edges, "shared participant" chains, pattern stats per category,
  land dot grid from Natural Earth. Writes `public/data/{events,edges,patterns,meta,land-dots}.json`.

- `fetch-extra.mjs` — reverse “participant in” (P1344), coordinates of every linked participant/country/effect, reference URLs (P854) and described-at URLs (P973).
- `fetch-religion.mjs` + `religions.mjs` + `texts.mjs` — religion layer: items with religion (P140) = one of 12 faiths (or a branch), classified into figure / text / site / event; founders (P112); every recorded date value with rank and P1480 qualifiers; public-domain text links.
- `fetch-topup.mjs` — incremental fetch for ids added after the first run (e.g. the “partitions” category).

## v2 features
- **Sources everywhere**: timeline tooltip, map popup, search results, echo chips and the detail panel “Sources” block (Wikipedia revision, Wikidata item, Wikidata reference URLs). All links `target=_blank rel="noopener noreferrer"`.
- **Impact ripple**: select an event → animated rings at its recorded locations, arcs to affected present-day countries, country shading by link count, ripple lanes on the timeline, and a per-country social / economic / political-military breakdown. Evidence: recorded in Wikidata (gold), linked event — not causation (blue), optional AI (purple, “AI-generated — verify”, user’s own OpenAI-compatible key kept in localStorage).
- **Religions**: new tab with a deep-time row per religion (origin, founders, figures, texts, sites, events), religion cards with recorded origin dates/alternatives, and public-domain text links; religion filter + colours across timeline, map and patterns.

## v3: live data, accounts and Ask Echoes
- **Live tab** (`L`): Wikipedia *On this day* (any date, cross-linked to Echoes events), GDELT world news (search + time span), USGS earthquakes; optional NewsData.io / Currents / Guardian panels when keys are set. Every item shows outlet/provider and links to the original.
- **Map live layers**: USGS quakes (sized by magnitude) and GDELT news grouped by outlet country, with source links in popups.
- **Related live news** in every event’s detail panel (GDELT, last 3 months; plus Guardian archive if configured).
- **Accounts**: email + password (scrypt), httpOnly SameSite=Lax session cookie, same-origin check on writes, login rate limit. Storage: JSON file in `.echoes-data/` (pure JS, Windows-friendly).
- **Profile**: connect OpenAI / Anthropic / Gemini / xAI / OpenRouter / custom OpenAI-compatible (base URL + model); key AES-256-GCM encrypted with `ECHOES_SECRET` (auto-generated into `.env.local`), masked to last 4, test / replace / delete. Keys never reach the browser.
- **Ask Echoes** (`/ask`): streaming chat grounded in dataset events + live news, with clickable numbered citations. **Explain impact** uses the same server-side key.
- API routes: `/api/auth/*`, `/api/profile/key[/test]`, `/api/ai/chat` (NDJSON stream), `/api/ai/impact`, `/api/live/{onthisday,news,quakes,related,keyed,status}`.
- Config: see `.env.example`. Tests: `node scripts/mock-openai.mjs` + server with `ECHOES_ALLOW_PRIVATE_BASEURL=1`, then `node scripts/e2e-ai.mjs`.

## Stack
Next.js 15 (App Router, TS), Tailwind v4, Motion, GSAP + ScrollTrigger, Lenis, zustand, MapLibre GL JS (clusters, globe projection),
@react-three/fiber (landing globe), lucide-react. Timeline is a custom canvas renderer (thousands of items at 60 fps).

## Screenshots
`node scripts/screenshots.mjs` with the server on :3010 → `screenshots/`.
