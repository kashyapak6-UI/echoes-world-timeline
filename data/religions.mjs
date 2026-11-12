// Major religions (Wikidata roots). Colours used across timeline, map and patterns.
export const RELIGIONS = [
  { id: "hinduism", label: "Hinduism", roots: ["Q9089", "Q194497"], color: "#ff9933" },
  { id: "judaism", label: "Judaism", roots: ["Q9268"], color: "#4f8dfd" },
  { id: "zoroastrianism", label: "Zoroastrianism", roots: ["Q9601"], color: "#e8583d" },
  { id: "buddhism", label: "Buddhism", roots: ["Q748"], color: "#f2c94c" },
  { id: "jainism", label: "Jainism", roots: ["Q9232"], color: "#c0d860" },
  { id: "christianity", label: "Christianity", roots: ["Q5043"], color: "#b78cff" },
  { id: "islam", label: "Islam", roots: ["Q432"], color: "#2fbf71" },
  { id: "sikhism", label: "Sikhism", roots: ["Q9316"], color: "#ffb347" },
  { id: "shinto", label: "Shinto", roots: ["Q812767"], color: "#ff6b81" },
  { id: "taoism", label: "Taoism", roots: ["Q9598"], color: "#5ed6d0" },
  { id: "confucianism", label: "Confucianism", roots: ["Q9581"], color: "#a3a8ff" },
  { id: "bahai", label: "Baháʼí Faith", roots: ["Q22679"], color: "#f07ec8" },
];
// Classes whose instances belong to a religion even without P140
export const CLASS_TO_RELIGION = { Q51645: "christianity", Q752404: "buddhism" }; // ecumenical council, Buddhist council
