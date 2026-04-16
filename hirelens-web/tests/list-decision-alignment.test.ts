import type { DecisionAnalysis } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  isPersistedDecisionAligned,
  listApplyGuidanceFromDecisionOrMatch,
} from "@/lib/services/decision-service";
import type { NormalizedImpactMetrics } from "@/lib/types/impact-metrics";

const minimalImpact: NormalizedImpactMetrics = {
  ats_score_before: null,
  ats_score_after: null,
  keyword_gain: null,
  impact_score: 55,
  missing_critical_keywords: [],
  apply_recommendation: null,
  confidence: "low",
  notes: [],
};

function mockDecision(partial: Partial<DecisionAnalysis>): DecisionAnalysis {
  return {
    id: "d1",
    userId: "u1",
    jobId: "j1",
    resumeId: "r1",
    tailoredResumeId: null,
    matchAnalysisId: partial.matchAnalysisId ?? null,
    impactMetricId: partial.impactMetricId ?? null,
    recommendation: partial.recommendation ?? "maybe",
    confidence: "medium",
    decisionScore: null,
    reasons: [],
    risks: [],
    summary: "",
    provenance: "match_only",
    createdAt: new Date(),
    ...partial,
  } as DecisionAnalysis;
}

describe("isPersistedDecisionAligned", () => {
  it("requires matching matchAnalysisId and impact ids", () => {
    const p = mockDecision({ matchAnalysisId: "m1", impactMetricId: "i1" });
    expect(isPersistedDecisionAligned(p, "m1", "i1")).toBe(true);
    expect(isPersistedDecisionAligned(p, "m2", "i1")).toBe(false);
    expect(isPersistedDecisionAligned(p, "m1", null)).toBe(false);
  });

  it("treats null impact on both sides as aligned", () => {
    const p = mockDecision({ matchAnalysisId: "m1", impactMetricId: null });
    expect(isPersistedDecisionAligned(p, "m1", null)).toBe(true);
  });
});

describe("listApplyGuidanceFromDecisionOrMatch", () => {
  it("prefers persisted skip when aligned despite strong match", () => {
    const persisted = mockDecision({
      matchAnalysisId: "m1",
      impactMetricId: null,
      recommendation: "skip",
    });
    const g = listApplyGuidanceFromDecisionOrMatch(
      { id: "m1", matchScore: 0.92, verdict: "strong", breakdown: {} },
      persisted,
      null,
      null,
    );
    expect(g?.label).toBe("Skip");
  });

  it("falls back to match when impact id drifted", () => {
    const persisted = mockDecision({
      matchAnalysisId: "m1",
      impactMetricId: "old-impact",
      recommendation: "skip",
    });
    const g = listApplyGuidanceFromDecisionOrMatch(
      { id: "m1", matchScore: 0.5, verdict: "weak", breakdown: {} },
      persisted,
      "new-impact",
      null,
    );
    expect(g?.label).not.toBe("Skip");
  });

  it("returns null when no match and no impact (no defensible tier)", () => {
    expect(listApplyGuidanceFromDecisionOrMatch(null, null, null, null)).toBeNull();
  });

  it("uses impact-only buildDecision when no match but impact exists", () => {
    const g = listApplyGuidanceFromDecisionOrMatch(null, null, null, minimalImpact);
    expect(g).not.toBeNull();
    expect(g!.trust.inferredWithoutMatch).toBe(true);
    expect(["Apply", "Consider", "Skip"]).toContain(g!.label);
  });
});
