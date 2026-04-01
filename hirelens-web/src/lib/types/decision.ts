import { z } from "zod";

export const decisionRecommendationSchema = z.enum(["apply", "maybe", "skip"]);
export const decisionConfidenceSchema = z.enum(["low", "medium", "high"]);
export const decisionProvenanceSchema = z.enum(["none", "match_only", "match_and_impact"]);

export const decisionOutputSchema = z.object({
  recommendation: decisionRecommendationSchema,
  confidence: decisionConfidenceSchema,
  decision_score: z.number().nullable(),
  reasons: z.array(z.string()),
  risks: z.array(z.string()),
  summary: z.string(),
  provenance: decisionProvenanceSchema,
});

export type DecisionOutput = z.infer<typeof decisionOutputSchema>;
export type DecisionRecommendation = z.infer<typeof decisionRecommendationSchema>;
export type DecisionConfidence = z.infer<typeof decisionConfidenceSchema>;
export type DecisionProvenance = z.infer<typeof decisionProvenanceSchema>;
