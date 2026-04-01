/** Python pipeline uses 0–100; Prisma/UI expect 0–1. */
export function matchScoreToUnit(score100: number): number {
  return Math.round((score100 / 100) * 10000) / 10000;
}

/** Align Python verdict with UI tokens (mock used "moderate"). */
export function normalizeVerdict(verdict: string): string {
  const v = verdict.toLowerCase();
  if (v === "medium") return "moderate";
  return verdict;
}

export function matchLevelLabel(verdict: string): string {
  const v = verdict.toLowerCase();
  if (v === "strong") return "High match";
  if (v === "moderate" || v === "medium") return "Medium match";
  return "Low match";
}

/** Flask match_components use 0–100; UI breakdown expects 0–1 for thresholds. */
export function normalizeMatchComponents(mc: Record<string, number> | null | undefined): Record<string, number> {
  if (!mc) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(mc)) {
    if (typeof v !== "number" || Number.isNaN(v)) continue;
    out[k] = v > 1 ? Math.round((v / 100) * 10000) / 10000 : v;
  }
  return out;
}
