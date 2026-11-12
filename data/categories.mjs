// Pattern categories -> Wikidata classes (instance of / subclass of*).
// minSL = minimum Wikipedia sitelinks (a notability proxy); limit = max items kept (top by sitelinks).
export const CATEGORIES = [
  { id: "war", label: "Wars", classes: ["Q198"], minSL: 20, limit: 700, color: "#ef4444" },
  { id: "battle", label: "Battles & sieges", classes: ["Q178561", "Q188055"], minSL: 25, limit: 350, color: "#f97316" },
  { id: "revolution", label: "Revolutions, revolts & coups", classes: ["Q10931", "Q124734", "Q45382"], minSL: 12, limit: 380, color: "#eab308" },
  { id: "pandemic", label: "Pandemics & epidemics", classes: ["Q12184", "Q44512", "Q3241045"], minSL: 4, limit: 180, color: "#22c55e" },
  { id: "famine", label: "Famines & droughts", classes: ["Q168247", "Q43059"], minSL: 4, limit: 140, color: "#a3e635" },
  { id: "financial", label: "Financial crises & crashes", classes: ["Q114380", "Q1020018", "Q1814941", "Q176494", "Q1417912", "Q185565", "Q806729", "Q207781"], minSL: 3, limit: 160, color: "#06b6d4" },
  { id: "disaster", label: "Natural disasters", classes: ["Q7944", "Q7692360", "Q8070", "Q8068", "Q8092", "Q15725976"], minSL: 15, limit: 300, color: "#3b82f6" },
  { id: "migration", label: "Migrations & displacements", classes: ["Q177626", "Q15589476", "Q837556", "Q815962"], minSL: 3, limit: 160, color: "#8b5cf6" },
  { id: "atrocity", label: "Genocides & massacres", classes: ["Q41397", "Q3199915"], minSL: 15, limit: 160, color: "#be123c" },
  { id: "treaty", label: "Treaties & peace deals", classes: ["Q131569", "Q625298"], minSL: 20, limit: 250, color: "#14b8a6" },
  { id: "assassination", label: "Assassinations", classes: ["Q3882219"], minSL: 15, limit: 120, color: "#f43f5e" },
  { id: "partition", label: "Partitions & border changes", classes: ["Q518554"], minSL: 6, limit: 60, color: "#fda4af" },
  { id: "religion", label: "Schisms & persecutions", classes: ["Q126287984", "Q851824"], minSL: 5, limit: 100, color: "#d946ef" },
  { id: "empire", label: "Empires & states (rise / fall)", classes: ["Q48349", "Q3024240"], minSL: 40, limit: 500, color: "#f59e0b", span: true },
  { id: "dynasty", label: "Dynasties", classes: ["Q164950"], minSL: 25, limit: 160, color: "#fb923c", span: true },
  { id: "era", label: "Eras & periods", classes: ["Q11514315"], minSL: 30, limit: 300, color: "#94a3b8", span: true },
  { id: "tech", label: "Inventions & discoveries", property: "P575", minSL: 60, limit: 300, color: "#0ea5e9" },
];
