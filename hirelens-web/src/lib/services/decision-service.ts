import type { DecisionAnalysis } from "@prisma/client";
import type { NormalizedImpactMetrics } from "@/lib/types/impact-metrics";
import type {
  DecisionConfidence,
  DecisionOutput,
  DecisionProvenance,
  DecisionRecommendation,
} from "@/lib/types/decision";
import { prisma } from "@/lib/db/prisma";
import { getPrismaUserMessage, isMissingTableError } from "@/lib/db/prisma-errors";
import { normalizeImpactMetrics } from "@/lib/services/normalize-impact-metrics";
import { resolveUserId } from "@/lib/services/user";

export type MatchSlice = {
  id: string;
  matchScore: number;
  verdict: string;
  breakdown: unknown;
};

const EXCLUDE_BREAKDOWN_KEYS = new Set(["strengths", "gaps", "reasoning", "missing_keywords"]);

/** Match score is stored 0–1 in Prisma; impact fields use 0–100. */
export function matchPercent(score: number): number {
  if (Number.isNaN(score)) return 0;
  return score <= 1 ? score * 100 : Math.min(100, score);
}

export function analyzeBreakdown(breakdown: unknown): {
  gapDimCount: number;
  missingFromBreakdown: string[];
} {
  if (!breakdown || typeof breakdown !== "object") {
    return { gapDimCount: 0, missingFromBreakdown: [] };
  }
  const b = breakdown as Record<string, unknown>;
  let gapDimCount = 0;
  for (const [k, v] of Object.entries(b)) {
    if (EXCLUDE_BREAKDOWN_KEYS.has(k)) continue;
    if (typeof v === "number" && v < 0.65) gapDimCount++;
  }
  const missingFromBreakdown = Array.isArray(b.missing_keywords) ? b.missing_keywords.map(String) : [];
  return { gapDimCount, missingFromBreakdown };
}

export type BuildDecisionOptions = {
  /** Makes “no match yet” copy refer to this resume by title. */
  resumeTitle?: string;
};

function resumeLabel(options?: BuildDecisionOptions): string {
  return options?.resumeTitle ? `“${options.resumeTitle}”` : "this resume";
}

type DecisionEvidence = {
  strengths: string[];
  gaps: string[];
  missingKeywords: string[];
  dimensionScores: Array<{ key: string; value: number }>;
};

function asEvidence(breakdown: unknown): DecisionEvidence {
  if (!breakdown || typeof breakdown !== "object") {
    return { strengths: [], gaps: [], missingKeywords: [], dimensionScores: [] };
  }
  const b = breakdown as Record<string, unknown>;
  const strengths = Array.isArray(b.strengths) ? b.strengths.map(String) : [];
  const gaps = Array.isArray(b.gaps) ? b.gaps.map(String) : [];
  const missingKeywords = Array.isArray(b.missing_keywords) ? b.missing_keywords.map(String) : [];
  const dimensionScores = Object.entries(b)
    .filter(([k, v]) => !EXCLUDE_BREAKDOWN_KEYS.has(k) && typeof v === "number")
    .map(([key, value]) => ({ key, value: Number(value) }));
  return { strengths, gaps, missingKeywords, dimensionScores };
}

function topDimension(
  dims: Array<{ key: string; value: number }>,
  mode: "high" | "low",
): { key: string; value: number } | null {
  if (dims.length === 0) return null;
  const sorted = [...dims].sort((a, b) => (mode === "high" ? b.value - a.value : a.value - b.value));
  return sorted[0] ?? null;
}

function confidenceMeaning(conf: DecisionOutput["confidence"]): string {
  if (conf === "high") return "Evidence suggests you are likely competitive for this role with this resume.";
  if (conf === "medium") return "This may be worth applying to, but there are notable tradeoffs to weigh first.";
  return "Current evidence is weak for this resume-job pairing and applying may have low return.";
}

/** When the user has no resumes in the library at all. */
export function buildEmptyResumeLibraryDecision(): DecisionOutput {
  return {
    recommendation: "maybe",
    confidence: "low",
    decision_score: null,
    reasons: ["Create a resume in the library to measure fit against this job."],
    risks: ["No candidate profile to compare to the posting."],
    summary:
      "Add a resume first, then return here to run Score match and get an apply / maybe / skip recommendation for that resume.",
    provenance: "none",
  };
}

/**
 * Deterministic decision engine: match + optional impact. No invented optimism.
 */
export function buildDecision(
  input: {
    match: MatchSlice | null;
    impact: NormalizedImpactMetrics | null;
  },
  options?: BuildDecisionOptions,
): DecisionOutput {
  const { match, impact } = input;
  const rl = resumeLabel(options);

  if (!match) {
    if (impact) {
      return {
        recommendation: "maybe",
        confidence: "low",
        decision_score: impact.impact_score,
        reasons: [
          options?.resumeTitle
            ? `Impact exists for ${rl}, but there is no match score — run Score match for this resume and job.`
            : "Impact evaluation exists but no match score on record — run Score match to combine fit with impact.",
        ],
        risks: ["Cannot judge overall apply-worthiness without a match analysis."],
        summary: "Run Score match for this resume and job, then refresh the decision.",
        provenance: "none",
      };
    }
    return {
      recommendation: "maybe",
      confidence: "low",
      decision_score: null,
      reasons: [`No match score for ${rl} vs this job — run Score match for this resume.`],
      risks: ["Fit vs this posting is unknown until you score this resume against the job."],
      summary: `Run Score match for ${rl} to get an apply / maybe / skip recommendation grounded in fit data.`,
      provenance: "none",
    };
  }

  const mPct = matchPercent(match.matchScore);
  const { gapDimCount, missingFromBreakdown } = analyzeBreakdown(match.breakdown);
  const ev = asEvidence(match.breakdown);
  const risks: string[] = [];
  let riskPoints = 0;

  if (mPct < 50) {
    risks.push("Overall match strength is below a typical apply threshold.");
    riskPoints += 2;
  }
  if (gapDimCount > 2) {
    risks.push("Several capability dimensions score below target in the match breakdown.");
    riskPoints += 1;
  }
  if (missingFromBreakdown.length > 0) {
    risks.push(`Match flagged missing keywords: ${missingFromBreakdown.slice(0, 5).join(", ")}.`);
    riskPoints += 1;
  }

  if (!impact) {
    let rec: DecisionOutput["recommendation"] = "maybe";
    if (mPct >= 72) rec = "apply";
    else if (mPct < 48) rec = "skip";
    else if (mPct < 58) rec = "maybe";

    if (riskPoints >= 3 && rec === "apply") rec = "maybe";
    if (riskPoints >= 5 && rec !== "skip") rec = "skip";

    let conf: DecisionOutput["confidence"] = "medium";
    if (mPct >= 68 && riskPoints <= 1) conf = "medium";
    if (mPct < 55 || riskPoints >= 2) conf = "low";
    if (mPct >= 75 && riskPoints === 0) conf = "medium";

    const reasons: string[] = [];
    const strongestDim = topDimension(ev.dimensionScores, "high");
    const weakestDim = topDimension(ev.dimensionScores, "low");

    reasons.push(
      `Match signal is ${Math.round(mPct)}% (${match.verdict})${options?.resumeTitle ? ` for ${rl}` : ""}, indicating ${
        mPct >= 70 ? "strong baseline role alignment" : mPct >= 58 ? "moderate baseline role alignment" : "limited baseline role alignment"
      }.`,
    );
    if (ev.strengths.length > 0) {
      reasons.push(`The resume highlights strengths such as ${ev.strengths.slice(0, 2).join(" and ")}.`);
    } else if (strongestDim) {
      reasons.push(
        `Best-aligned capability appears to be ${strongestDim.key} at ~${Math.round(strongestDim.value * 100)}%.`,
      );
    }
    if (weakestDim && weakestDim.value < 0.65) {
      reasons.push(
        `Lowest-scoring capability is ${weakestDim.key} at ~${Math.round(weakestDim.value * 100)}%, which may limit competitiveness.`,
      );
    }
    reasons.push("Tailored impact has not been evaluated yet, so ATS lift and keyword gains are still unverified.");

    const decision_score = Math.round(Math.min(100, mPct * 0.82));

    if (ev.gaps.length > 0) {
      risks.push(`Gap analysis flags ${ev.gaps.slice(0, 2).join(" and ")} as weaker areas for this target role.`);
    }
    if (ev.missingKeywords.length > 0) {
      risks.push(
        `Several required keywords are still missing (${ev.missingKeywords.slice(0, 5).join(", ")}), which may reduce ATS competitiveness.`,
      );
    }
    if (mPct >= 55 && mPct < 70) {
      risks.push("Fit is moderate rather than decisive, so prioritize applying only if this role is high priority.");
    }
    if (risks.length === 0) {
      risks.push("Impact evaluation is not yet available, so improvement potential remains uncertain.");
    }

    const summary =
      rec === "apply"
        ? `Apply with ${conf} confidence: this resume looks broadly aligned, though tailored impact is still unverified.`
        : rec === "maybe"
          ? `Maybe with ${conf} confidence: alignment is mixed for this resume and should be strengthened before applying broadly.`
          : `Skip with ${conf} confidence: current fit evidence is weak for this resume-job pairing.`;

    return {
      recommendation: rec,
      confidence: conf,
      decision_score,
      reasons,
      risks: risks.slice(0, 6),
      summary: `${summary} ${confidenceMeaning(conf)}`,
      provenance: "match_only",
    };
  }

  const is = impact.impact_score ?? 0;
  const atsAfter = impact.ats_score_after ?? 0;
  const atsBefore = impact.ats_score_before ?? 0;
  const atsDelta = atsAfter - atsBefore;
  const kwGain = impact.keyword_gain ?? 0;
  const missingCritical = impact.missing_critical_keywords ?? [];

  if (missingCritical.length > 2) {
    riskPoints += 2;
    risks.push(
      `More than two critical JD keywords remain thin after tailoring: ${missingCritical.slice(0, 5).join(", ")}.`,
    );
  } else if (missingCritical.length > 0) {
    riskPoints += 1;
    risks.push(`Some JD keywords still underrepresented: ${missingCritical.slice(0, 6).join(", ")}.`);
  }

  if (gapDimCount > 2) {
    riskPoints += 1;
  }

  let rec: DecisionOutput["recommendation"] = "maybe";
  if (mPct >= 75 && is >= 65 && missingCritical.length === 0 && mPct >= 55) {
    rec = "apply";
  } else if (mPct < 50) {
    rec = "skip";
  } else if (mPct >= 60 && is >= 45) {
    rec = riskPoints <= 2 && mPct >= 66 ? "apply" : "maybe";
  } else {
    rec = mPct >= 62 ? "maybe" : "skip";
  }

  if (missingCritical.length > 2) {
    if (rec === "apply") rec = "maybe";
    else if (rec === "maybe" && riskPoints >= 5) rec = "skip";
  }

  if (impact.apply_recommendation === "no" && rec === "apply") rec = "maybe";
  if (impact.apply_recommendation === "yes" && rec === "skip" && mPct >= 58) rec = "maybe";

  let conf: DecisionOutput["confidence"] = "medium";
  if (mPct >= 72 && is >= 60 && missingCritical.length <= 1 && riskPoints <= 2) conf = "high";
  if (kwGain >= 3 && atsDelta >= 5 && is >= 55) conf = conf === "medium" ? "high" : conf;
  if (mPct < 52 || is < 38) conf = "low";
  if (riskPoints >= 4) conf = conf === "high" ? "medium" : conf === "medium" ? "low" : conf;

  const decision_score = Math.round(
    Math.min(100, 0.42 * mPct + 0.38 * is + 0.12 * atsAfter + 0.08 * Math.max(0, kwGain * 3)),
  );

  const reasons: string[] = [];
  const strongestDim = topDimension(ev.dimensionScores, "high");
  const weakestDim = topDimension(ev.dimensionScores, "low");

  reasons.push(
    `Baseline fit is ${Math.round(mPct)}% and tailored impact is ${Math.round(is)}, combining role alignment with post-tailoring evidence.`,
  );
  if (strongestDim) {
    reasons.push(
      `Strongest capability signal is ${strongestDim.key} at ~${Math.round(strongestDim.value * 100)}%, supporting role relevance.`,
    );
  } else if (ev.strengths.length > 0) {
    reasons.push(`Strength signals include ${ev.strengths.slice(0, 2).join(" and ")}.`);
  }
  reasons.push(
    atsDelta >= 3
      ? `Tailoring improved ATS-related signal from ~${atsBefore.toFixed(0)} to ~${atsAfter.toFixed(0)}.`
      : `ATS-related signal changed only slightly (~${atsBefore.toFixed(0)} to ~${atsAfter.toFixed(0)}).`,
  );
  reasons.push(
    kwGain >= 0.8
      ? `Keyword alignment improved by about ${kwGain.toFixed(1)} points after tailoring.`
      : "Keyword alignment improvement is modest, so gains are present but limited.",
  );
  if (weakestDim && weakestDim.value < 0.65) {
    reasons.push(
      `A weaker capability area remains (${weakestDim.key} ~${Math.round(weakestDim.value * 100)}%), which caps confidence.`,
    );
  }

  if (impact.notes?.[0]) {
    reasons.push(impact.notes[0].slice(0, 220));
  }

  if (missingCritical.length > 0) {
    risks.push(
      `Critical keyword gaps remain (${missingCritical.slice(0, 5).join(", ")}), which can still weaken screening outcomes.`,
    );
  }
  if (kwGain < 0.5) {
    risks.push("Impact analysis shows limited keyword lift, so tailoring did not materially strengthen this application yet.");
  }
  if (atsDelta < 2) {
    risks.push("ATS-related improvement is small, which lowers confidence in incremental tailoring gains.");
  }
  if (ev.gaps.length > 0) {
    risks.push(`Role-fit gap signals still include ${ev.gaps.slice(0, 2).join(" and ")}.`);
  }
  if (mPct < 58) {
    risks.push("Core fit remains moderate-to-low even after tailoring, so this pairing carries meaningful alignment risk.");
  }

  const summary =
    rec === "apply"
      ? `Apply with ${conf} confidence: this resume appears competitive for the role and impact evidence supports that direction. ${confidenceMeaning(conf)}`
      : rec === "maybe"
        ? `Maybe with ${conf} confidence: signals are mixed and this resume may be worth applying with selective targeting. ${confidenceMeaning(conf)}`
        : `Skip with ${conf} confidence: fit and risk signals suggest limited return for this resume on this role. ${confidenceMeaning(conf)}`;

  return {
    recommendation: rec,
    confidence: conf,
    decision_score: decision_score,
    reasons: reasons.slice(0, 8),
    risks: risks.slice(0, 6),
    summary,
    provenance: "match_and_impact",
  };
}

export type LoadedDecisionContext = {
  decision: DecisionOutput;
  matchAnalysisId: string | null;
  impactMetricId: string | null;
  tailoredResumeId: string | null;
};

/** Job Detail: decision for a specific resume, or empty-library state when resumeId is null. */
export async function loadDecisionForJobDetail(
  userId: string,
  jobId: string,
  resumeId: string | null,
  resumeTitle?: string | null,
): Promise<LoadedDecisionContext> {
  if (!resumeId) {
    return {
      decision: buildEmptyResumeLibraryDecision(),
      matchAnalysisId: null,
      impactMetricId: null,
      tailoredResumeId: null,
    };
  }
  return loadDecisionForResumeJob(userId, jobId, resumeId, undefined, resumeTitle ?? undefined);
}

/** Load match + impact for explicit resume/job (optionally pinned tailored row). */
export async function loadDecisionForResumeJob(
  userId: string,
  jobId: string,
  resumeId: string,
  tailoredResumeId?: string | null,
  resumeTitle?: string,
): Promise<LoadedDecisionContext> {
  const latestMatch = await prisma.matchAnalysis.findFirst({
    where: { userId, jobId, resumeId },
    orderBy: { createdAt: "desc" },
  });

  const tailored =
    tailoredResumeId != null
      ? await prisma.tailoredResume.findFirst({
          where: { id: tailoredResumeId, userId, jobId, resumeId },
        })
      : await prisma.tailoredResume.findFirst({
          where: { userId, jobId, resumeId },
          orderBy: { updatedAt: "desc" },
        });

  let impact: NormalizedImpactMetrics | null = null;
  let impactMetricId: string | null = null;
  if (tailored) {
    const im = await prisma.impactMetric.findFirst({
      where: { userId, tailoredResumeId: tailored.id },
      orderBy: { createdAt: "desc" },
    });
    if (im) {
      impact = normalizeImpactMetrics(im.metrics);
      impactMetricId = im.id;
    }
  }

  const latestPersisted = await prisma.decisionAnalysis.findFirst({
    where: { userId, jobId, resumeId },
    orderBy: { createdAt: "desc" },
  });

  const opts: BuildDecisionOptions | undefined = resumeTitle ? { resumeTitle } : undefined;

  if (
    latestPersisted &&
    latestMatch &&
    isPersistedDecisionAligned(latestPersisted, latestMatch.id, impactMetricId)
  ) {
    return {
      decision: decisionAnalysisRowToOutput(latestPersisted),
      matchAnalysisId: latestMatch.id,
      impactMetricId,
      tailoredResumeId: tailored?.id ?? null,
    };
  }

  if (!latestMatch) {
    return {
      decision: buildDecision({ match: null, impact }, opts),
      matchAnalysisId: null,
      impactMetricId,
      tailoredResumeId: tailored?.id ?? null,
    };
  }

  const matchSlice: MatchSlice = {
    id: latestMatch.id,
    matchScore: latestMatch.matchScore,
    verdict: latestMatch.verdict,
    breakdown: latestMatch.breakdown,
  };

  return {
    decision: buildDecision({ match: matchSlice, impact }, opts),
    matchAnalysisId: latestMatch.id,
    impactMetricId,
    tailoredResumeId: tailored?.id ?? null,
  };
}

export async function evaluateAndMaybePersistDecision(input: {
  jobId: string;
  resumeId: string;
  tailoredResumeId?: string | null;
  persist?: boolean;
  userId?: string;
}): Promise<LoadedDecisionContext> {
  const userId = await resolveUserId(input.userId);
  const resumeRow = await prisma.resume.findFirst({
    where: { id: input.resumeId, userId },
    select: { title: true },
  });
  const ctx = await loadDecisionForResumeJob(
    userId,
    input.jobId,
    input.resumeId,
    input.tailoredResumeId,
    resumeRow?.title,
  );

  if (input.persist) {
    try {
      await prisma.decisionAnalysis.create({
        data: {
          userId,
          jobId: input.jobId,
          resumeId: input.resumeId,
          tailoredResumeId: ctx.tailoredResumeId,
          matchAnalysisId: ctx.matchAnalysisId,
          impactMetricId: ctx.impactMetricId,
          recommendation: ctx.decision.recommendation,
          confidence: ctx.decision.confidence,
          decisionScore: ctx.decision.decision_score,
          reasons: ctx.decision.reasons as object,
          risks: ctx.decision.risks as object,
          summary: ctx.decision.summary,
          provenance: ctx.decision.provenance,
        },
      });
    } catch (e) {
      const hint = getPrismaUserMessage(e);
      if (isMissingTableError(e)) {
        throw new Error(
          `Cannot save decision: DecisionAnalysis table is missing. Apply the schema (${hint})`,
        );
      }
      throw new Error(`Cannot save decision: ${hint}`);
    }
  }

  return ctx;
}

/** Compact label for job list from match score only (no DB impact fetch). */
export function quickDecisionLabelFromMatch(matchScore: number): {
  label: string;
  tone: "success" | "warning" | "danger" | "muted";
} {
  const p = matchPercent(matchScore);
  if (p >= 72) return { label: "Favorable", tone: "success" };
  if (p >= 55) return { label: "Mixed", tone: "warning" };
  if (p >= 40) return { label: "Weak", tone: "danger" };
  return { label: "Low fit", tone: "muted" };
}

/**
 * Coarse apply / consider / skip hint for job list rows.
 * Uses verdict when decisive, otherwise the same score bands as internal decision hints (~72% / ~48%).
 */
export function quickApplyGuidanceFromMatch(
  matchScore: number,
  verdict: string,
): { label: "Apply" | "Consider" | "Skip"; tone: "success" | "warning" | "danger" } {
  const p = matchPercent(matchScore);
  const v = verdict.trim().toLowerCase();

  if (v === "strong") return { label: "Apply", tone: "success" };
  if (v === "poor") return { label: "Skip", tone: "danger" };
  if (v === "weak" && p < 45) return { label: "Skip", tone: "danger" };
  if (v === "weak") return { label: "Consider", tone: "warning" };

  if (p >= 72) return { label: "Apply", tone: "success" };
  if (p < 48) return { label: "Skip", tone: "danger" };
  return { label: "Consider", tone: "warning" };
}

function jsonToStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (x == null ? "" : String(x))).filter((s) => s.length > 0);
}

function coerceRecommendation(raw: string): DecisionRecommendation {
  const s = raw.trim().toLowerCase();
  if (s === "apply" || s === "maybe" || s === "skip") return s;
  return "maybe";
}

function coerceConfidence(raw: string): DecisionConfidence {
  const s = raw.trim().toLowerCase();
  if (s === "high" || s === "medium" || s === "low") return s;
  return "medium";
}

function coerceProvenance(raw: string): DecisionProvenance {
  const s = raw.trim().toLowerCase();
  if (s === "none" || s === "match_only" || s === "match_and_impact") return s;
  return "match_only";
}

/** Rehydrate a stored row into the same shape the UI / engine use (no recompute). */
export function decisionAnalysisRowToOutput(row: DecisionAnalysis): DecisionOutput {
  return {
    recommendation: coerceRecommendation(row.recommendation),
    confidence: coerceConfidence(row.confidence),
    decision_score: row.decisionScore,
    reasons: jsonToStringArray(row.reasons),
    risks: jsonToStringArray(row.risks),
    summary: row.summary,
    provenance: coerceProvenance(row.provenance),
  };
}

/** True when this persisted row still matches current match + impact pointers. */
export function isPersistedDecisionAligned(
  persisted: Pick<DecisionAnalysis, "matchAnalysisId" | "impactMetricId">,
  latestMatchId: string | null,
  currentImpactMetricId: string | null,
): boolean {
  if (!latestMatchId || persisted.matchAnalysisId !== latestMatchId) return false;
  return (persisted.impactMetricId ?? null) === (currentImpactMetricId ?? null);
}

function listGuidanceFromRecommendation(rec: DecisionRecommendation): {
  label: "Apply" | "Consider" | "Skip";
  tone: "success" | "warning" | "danger";
} {
  if (rec === "apply") return { label: "Apply", tone: "success" };
  if (rec === "skip") return { label: "Skip", tone: "danger" };
  return { label: "Consider", tone: "warning" };
}

/**
 * Jobs list guidance when evidence supports a tier (match and/or impact via existing `buildDecision`).
 * `null` = insufficient signals for a defensible Apply / Consider / Skip — use an explicit “other” bucket, not a fake chip.
 */
export type ListApplyGuidance = {
  label: "Apply" | "Consider" | "Skip";
  tone: "success" | "warning" | "danger";
  trust: {
    confidence: DecisionConfidence;
    /** True when there is no match analysis row; label comes from impact-only `buildDecision` output. */
    inferredWithoutMatch: boolean;
  };
};

/** Sort tier for feed ranking — must stay in sync with `listApplyGuidanceFromDecisionOrMatch` labels. */
export function feedTierFromListGuidance(
  g: { label: "Apply" | "Consider" | "Skip" } | null,
): number {
  if (!g) return 0;
  if (g.label === "Apply") return 3;
  if (g.label === "Consider") return 2;
  return 1;
}

/**
 * Jobs list badge: prefer latest persisted DecisionAnalysis when it matches current match + impact;
 * otherwise the same `buildDecision` path as job detail (match + optional impact for this job).
 */
export function listApplyGuidanceFromDecisionOrMatch(
  latestMatch:
    | { id: string; matchScore: number; verdict: string; breakdown: unknown }
    | null
    | undefined,
  persisted: DecisionAnalysis | null | undefined,
  currentImpactMetricId: string | null,
  impact: NormalizedImpactMetrics | null,
): ListApplyGuidance | null {
  if (
    latestMatch &&
    persisted &&
    isPersistedDecisionAligned(persisted, latestMatch.id, currentImpactMetricId)
  ) {
    const g = listGuidanceFromRecommendation(coerceRecommendation(persisted.recommendation));
    return {
      ...g,
      trust: {
        confidence: coerceConfidence(persisted.confidence),
        inferredWithoutMatch: false,
      },
    };
  }
  if (latestMatch) {
    const matchSlice: MatchSlice = {
      id: latestMatch.id,
      matchScore: latestMatch.matchScore,
      verdict: latestMatch.verdict,
      breakdown: latestMatch.breakdown,
    };
    const d = buildDecision({ match: matchSlice, impact }, undefined);
    const g = listGuidanceFromRecommendation(d.recommendation);
    return {
      ...g,
      trust: { confidence: d.confidence, inferredWithoutMatch: false },
    };
  }
  if (!impact) {
    return null;
  }
  const d = buildDecision({ match: null, impact }, undefined);
  const g = listGuidanceFromRecommendation(d.recommendation);
  return {
    ...g,
    trust: { confidence: d.confidence, inferredWithoutMatch: true },
  };
}
