import { z } from "zod";

/** Frontend + persistence contract for impact evaluation (mock + Flask). */
export const normalizedImpactMetricsSchema = z.object({
  ats_score_before: z.number().nullable(),
  ats_score_after: z.number().nullable(),
  keyword_gain: z.number().nullable(),
  impact_score: z.number().nullable(),
  missing_critical_keywords: z.array(z.string()),
  apply_recommendation: z.enum(["yes", "maybe", "no"]).nullable(),
  confidence: z.enum(["low", "medium", "high"]).nullable(),
  notes: z.array(z.string()),
});

export type NormalizedImpactMetrics = z.infer<typeof normalizedImpactMetricsSchema>;
