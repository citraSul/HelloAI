import type { NormalizedImpactMetrics } from "@/lib/types/impact-metrics";

/** Deterministic mock metrics when Flask is disabled — same contract as Python `evaluate_resume_impact`. */
export async function evaluateImpactMock(input: {
  originalResume: string;
  tailoredResume: string;
  jobDescription: string;
}): Promise<NormalizedImpactMetrics> {
  const { originalResume, tailoredResume, jobDescription } = input;
  const seed = (originalResume.length + tailoredResume.length + jobDescription.length) % 97;
  const base = 45 + (seed % 28);
  const ats_score_before = Math.min(92, base);
  const delta = 2 + (seed % 14);
  const ats_score_after = Math.min(100, ats_score_before + delta);
  const keyword_gain = Math.round((ats_score_after - ats_score_before) * 0.32 * 10) / 10;
  const impact_score = Math.min(
    100,
    Math.round((0.55 * ats_score_after + 0.45 * Math.min(100, 48 + keyword_gain * 2.2)) * 10) / 10,
  );

  let apply: NormalizedImpactMetrics["apply_recommendation"] = "maybe";
  if (ats_score_after >= 72 && keyword_gain >= 2) apply = "yes";
  else if (ats_score_after < 42 && keyword_gain < 1) apply = "no";

  const confidence: NormalizedImpactMetrics["confidence"] =
    jobDescription.length > 400 ? "high" : jobDescription.length > 120 ? "medium" : "low";

  return {
    ats_score_before,
    ats_score_after,
    keyword_gain,
    impact_score,
    missing_critical_keywords: [],
    apply_recommendation: apply,
    confidence,
    notes: [
      "Mock impact metrics (Python pipeline disabled). Set FLASK_BASE_URL and HIRELENS_INTERNAL_API_KEY for full ATS-style evaluation.",
    ],
  };
}
