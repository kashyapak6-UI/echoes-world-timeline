import type { EdgeKind } from "./types";
export const EDGE_META: Record<EdgeKind, { color: string; label: string; out: string; in: string; source: string }> = {
  cause: { color: "#f5c97a", label: "Cause → effect", out: "Led to", in: "Caused by", source: "Wikidata P828 has cause / P1542 has effect / P1478 immediate cause" },
  part: { color: "#7cc4ff", label: "Part of", out: "Part of", in: "Includes", source: "Wikidata P361 part of / P527 has part" },
  sequence: { color: "#a78bfa", label: "Sequence / succession", out: "Followed by", in: "Preceded by", source: "Wikidata P155/P156 follows/followed by, P1365/P1366 replaces/replaced by" },
  involves: { color: "#34d399", label: "Involves", out: "Involves", in: "Involved in", source: "Wikidata P710 participant, P17 country, P793 significant event" },
  shared: { color: "#94a3b8", label: "Same participant", out: "Next with same participant", in: "Previous with same participant", source: "Computed: consecutive events sharing a Wikidata participant/country (P710/P17)" },
};
