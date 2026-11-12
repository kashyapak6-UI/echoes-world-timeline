// Openly readable source texts per religion. Every entry verified on the hosting page (Nov 2026).
// Only public-domain translations / openly licensed texts; copyrighted ones are listed in SKIPPED.
const ws = (t) => `https://en.wikisource.org/wiki/${t}`;
const pg = (n) => `https://www.gutenberg.org/ebooks/${n}`;
export const TEXTS = {
  judaism: [
    { title: "Tanakh — JPS 1917 translation", url: ws("Bible_(Jewish_Publication_Society_1917)"), host: "Wikisource", licence: "Public domain in the US (published 1917, before 1931)" },
  ],
  christianity: [
    { title: "Bible — King James Version (1611)", url: pg(10), host: "Project Gutenberg", licence: "Public domain in the USA (per Project Gutenberg); Crown rights apply in the UK" },
    { title: "World English Bible", url: pg(8294), host: "Project Gutenberg", licence: "Public domain (dedicated by its publisher; PG: public domain in the USA)" },
  ],
  islam: [
    { title: "The Meaning of the Glorious Koran — M. Pickthall (1930)", url: ws("The_Meaning_of_the_Glorious_Koran_(1930)"), host: "Wikisource", licence: "Public domain in the US (published before 1931); translator died 1936" },
    { title: "The Koran — J. M. Rodwell (1861)", url: pg(2800), host: "Project Gutenberg", licence: "Public domain in the USA" },
    { title: "Quran, Arabic text (Tanzil)", url: "https://tanzil.net/", host: "Tanzil Project", licence: "CC BY 3.0 with Tanzil terms: verbatim copies only, credit + link to tanzil.net (linked only, not copied)" },
  ],
  hinduism: [
    { title: "The Hymns of the Rigveda — R. T. H. Griffith", url: ws("The_Hymns_of_the_Rigveda"), host: "Wikisource", licence: "Public domain worldwide (translator died 100+ years ago)" },
    { title: "Bhagavad Gita — “The Song Celestial”, Edwin Arnold (1885)", url: pg(2388), host: "Project Gutenberg", licence: "Public domain in the USA" },
    { title: "Bhagavad Gita — K. T. Telang (Sacred Books of the East, vol. 8, 1882)", url: ws("Sacred_Books_of_the_East/Volume_8"), host: "Wikisource", licence: "Public domain (published 1882; translator died 1893)" },
    { title: "The Upanishads — Swami Paramananda (1919)", url: pg(3283), host: "Project Gutenberg", licence: "Public domain in the USA" },
  ],
  buddhism: [
    { title: "Dhammapada — F. Max Müller (1881)", url: pg(2017), host: "Project Gutenberg", licence: "Public domain in the USA" },
  ],
  zoroastrianism: [
    { title: "Zend-Avesta: Vendidad — J. Darmesteter (Sacred Books of the East, vol. 4, 1880)", url: ws("Sacred_Books_of_the_East/Volume_4"), host: "Wikisource", licence: "Public domain (published 1880; translator died 1894); transcription incomplete" },
  ],
  jainism: [
    { title: "Jaina Sutras — H. Jacobi (Sacred Books of the East, vol. 22, 1884)", url: ws("Sacred_Books_of_the_East/Volume_22"), host: "Wikisource", licence: "Public domain (published 1884; translator died 1937)" },
  ],
  taoism: [
    { title: "Tao Teh King — James Legge (1891)", url: pg(216), host: "Project Gutenberg", licence: "Public domain in the USA" },
  ],
  confucianism: [
    { title: "The Analects of Confucius — James Legge", url: pg(3330), host: "Project Gutenberg", licence: "Public domain in the USA" },
  ],
  shinto: [
    { title: "Kojiki — B. H. Chamberlain (1882)", url: ws("Kojiki"), host: "Wikisource", licence: "Public domain (published 1882; translator died 1935)" },
  ],
  sikhism: [
    { title: "The Sikh Religion — M. A. Macauliffe (1909), incl. translated hymns of the Guru Granth Sahib", url: ws("The_Sikh_Religion"), host: "Wikisource", licence: "Public domain worldwide (author died 100+ years ago)" },
  ],
  bahai: [
    { title: "The Book of Ighan (Kitáb-i-Íqán) — tr. Ali Kuli Khan (1904)", url: ws("The_Book_of_Ighan"), host: "Wikisource", licence: "Public domain worldwide (published before 1931; translator died 100+ years ago per Wikisource)" },
  ],
};
export const SKIPPED = [
  { title: "Guru Granth Sahib — modern English translations (Talib, Sant Singh Khalsa, Manmohan Singh…)", why: "Still in copyright (Wikisource lists them as copyrighted until 2056–2080)." },
  { title: "Guru Granth Sahib — Gurmukhi original text online", why: "The scripture itself is centuries old, but no openly licensed digital edition with clear terms was verified; linked Macauliffe (1909) instead." },
  { title: "Quran — A. Yusuf Ali (1934)", why: "US public-domain status not verified (1934 publication); Pickthall 1930 and Rodwell 1861 used instead." },
  { title: "Baháʼí writings — Shoghi Effendi translations (1930s+)", why: "Copyright status not verified; the 1904 Ali Kuli Khan translation is used instead." },
  { title: "sacred-texts.com pages", why: "Underlying texts are mostly public domain, but Wikisource/Gutenberg copies with explicit licence statements were preferred." },
];
