import type { DecisionRecommendation } from "@/lib/types/decision";

/** User-facing triad — internal API still uses `maybe` for the middle tier. */
export function recommendationDisplayLabel(rec: DecisionRecommendation): "Apply" | "Consider" | "Skip" {
  if (rec === "apply") return "Apply";
  if (rec === "skip") return "Skip";
  return "Consider";
}

/** Inline triad for headings and hints (middle tier = Consider). */
export const DECISION_TRIAD_INLINE = "Apply · Consider · Skip";

/** Sentence-style for prose. */
export const DECISION_TRIAD_READABLE = "Apply, Consider, or Skip";
