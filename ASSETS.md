# Assets & data licences

| Asset | Source | Licence | Notes |
|---|---|---|---|
| Event items, dates, coordinates, classes, relations | Wikidata (query.wikidata.org) | CC0 1.0 | No attribution required; credited anyway. |
| Event summaries (`x` field in events.json) | English Wikipedia (TextExtracts API) | CC BY-SA 4.0 | Shown verbatim with article title + revision id + licence. Redistributing `events.json` = redistributing CC BY-SA text: keep attribution and share-alike. |
| Basemap tiles (Dark / Light) | OpenFreeMap (tiles.openfreemap.org) | Free service, no key; data © OpenStreetMap contributors (ODbL 1.0), OpenMapTiles | Attribution rendered on the map. Service is "as-is"; self-host OpenFreeMap/Protomaps for production SLAs. |
| Map glyphs (Noto Sans) | OpenFreeMap fonts | SIL OFL 1.1 | |
| Land polygons (`public/data/land.geojson`, `land-dots.json`) | Natural Earth 1:110m land | Public domain | |
| Country polygons + label points (`public/data/countries.geojson`, `countries-meta.json`) | Natural Earth 1:110m Admin-0 countries | Public domain | Impact-ripple shading and present-day country mapping. |
| Reference URLs per event (`src` in events.json) | Wikidata P854 references + P973 described-at | CC0 (the URLs); linked pages keep their own licences | Linked only, never copied. |
| Religion layer (origins, figures, texts, sites, events) | Wikidata + Wikipedia | CC0 / CC BY-SA 4.0 | Dates only as recorded in Wikidata; none extracted from scripture. |
| Fonts: Instrument Serif, Inter, JetBrains Mono | Google Fonts via next/font | SIL OFL 1.1 | |
| Icons | lucide-react | ISC | |
| MapLibre GL JS | maplibre.org | BSD-3-Clause | |
| three.js / R3F / GSAP / Motion / Lenis | npm | MIT / MIT / GSAP standard licence (free incl. commercial) / MIT / MIT | |

## Live data (fetched at request time, cached briefly on the server; headlines + links only)

| Source | Keyed? | Licence / terms |
|---|---|---|
| Wikipedia On this day (api.wikimedia.org feed) | No | CC BY-SA 4.0 |
| GDELT DOC 2.0 API | No (≈1 request / 5 s; queued server-side) | Free incl. commercial with citation + link |
| USGS earthquake GeoJSON feeds | No | US public domain |
| NewsData.io | `NEWSDATA_API_KEY` (cap `NEWSDATA_DAILY_CAP`, default 150/day) | Provider terms |
| Currents API | `CURRENTS_API_KEY` (cap `CURRENTS_DAILY_CAP`, default 300/day) | Provider terms |
| The Guardian Open Platform | `GUARDIAN_API_KEY` (cap `GUARDIAN_DAILY_CAP`, default 400/day) | Developer key: non-commercial |

## Religious texts (linked only — nothing copied into the site)

| Religion | Text | URL | Licence / status |
|---|---|---|---|
| Hinduism | The Hymns of the Rigveda — R. T. H. Griffith | https://en.wikisource.org/wiki/The_Hymns_of_the_Rigveda | Public domain worldwide (translator died 100+ years ago) |
| Hinduism | Bhagavad Gita — “The Song Celestial”, Edwin Arnold (1885) | https://www.gutenberg.org/ebooks/2388 | Public domain in the USA |
| Hinduism | Bhagavad Gita — K. T. Telang (Sacred Books of the East, vol. 8, 1882) | https://en.wikisource.org/wiki/Sacred_Books_of_the_East/Volume_8 | Public domain (published 1882; translator died 1893) |
| Hinduism | The Upanishads — Swami Paramananda (1919) | https://www.gutenberg.org/ebooks/3283 | Public domain in the USA |
| Judaism | Tanakh — JPS 1917 translation | https://en.wikisource.org/wiki/Bible_(Jewish_Publication_Society_1917) | Public domain in the US (published 1917, before 1931) |
| Zoroastrianism | Zend-Avesta: Vendidad — J. Darmesteter (Sacred Books of the East, vol. 4, 1880) | https://en.wikisource.org/wiki/Sacred_Books_of_the_East/Volume_4 | Public domain (published 1880; translator died 1894); transcription incomplete |
| Buddhism | Dhammapada — F. Max Müller (1881) | https://www.gutenberg.org/ebooks/2017 | Public domain in the USA |
| Jainism | Jaina Sutras — H. Jacobi (Sacred Books of the East, vol. 22, 1884) | https://en.wikisource.org/wiki/Sacred_Books_of_the_East/Volume_22 | Public domain (published 1884; translator died 1937) |
| Christianity | Bible — King James Version (1611) | https://www.gutenberg.org/ebooks/10 | Public domain in the USA (per Project Gutenberg); Crown rights apply in the UK |
| Christianity | World English Bible | https://www.gutenberg.org/ebooks/8294 | Public domain (dedicated by its publisher; PG: public domain in the USA) |
| Islam | The Meaning of the Glorious Koran — M. Pickthall (1930) | https://en.wikisource.org/wiki/The_Meaning_of_the_Glorious_Koran_(1930) | Public domain in the US (published before 1931); translator died 1936 |
| Islam | The Koran — J. M. Rodwell (1861) | https://www.gutenberg.org/ebooks/2800 | Public domain in the USA |
| Islam | Quran, Arabic text (Tanzil) | https://tanzil.net/ | CC BY 3.0 with Tanzil terms: verbatim copies only, credit + link to tanzil.net (linked only, not copied) |
| Sikhism | The Sikh Religion — M. A. Macauliffe (1909), incl. translated hymns of the Guru Granth Sahib | https://en.wikisource.org/wiki/The_Sikh_Religion | Public domain worldwide (author died 100+ years ago) |
| Shinto | Kojiki — B. H. Chamberlain (1882) | https://en.wikisource.org/wiki/Kojiki | Public domain (published 1882; translator died 1935) |
| Taoism | Tao Teh King — James Legge (1891) | https://www.gutenberg.org/ebooks/216 | Public domain in the USA |
| Confucianism | The Analects of Confucius — James Legge | https://www.gutenberg.org/ebooks/3330 | Public domain in the USA |
| Baháʼí Faith | The Book of Ighan (Kitáb-i-Íqán) — tr. Ali Kuli Khan (1904) | https://en.wikisource.org/wiki/The_Book_of_Ighan | Public domain worldwide (published before 1931; translator died 100+ years ago per Wikisource) |

### Considered and not linked

- **Guru Granth Sahib — modern English translations (Talib, Sant Singh Khalsa, Manmohan Singh…)** — Still in copyright (Wikisource lists them as copyrighted until 2056–2080).
- **Guru Granth Sahib — Gurmukhi original text online** — The scripture itself is centuries old, but no openly licensed digital edition with clear terms was verified; linked Macauliffe (1909) instead.
- **Quran — A. Yusuf Ali (1934)** — US public-domain status not verified (1934 publication); Pickthall 1930 and Rodwell 1861 used instead.
- **Baháʼí writings — Shoghi Effendi translations (1930s+)** — Copyright status not verified; the 1904 Ali Kuli Khan translation is used instead.
- **sacred-texts.com pages** — Underlying texts are mostly public domain, but Wikisource/Gutenberg copies with explicit licence statements were preferred.

No images, photos or paid assets are used. The optional "Explain impact" AI feature calls only an endpoint the user configures with their own key; no AI provider is bundled.
