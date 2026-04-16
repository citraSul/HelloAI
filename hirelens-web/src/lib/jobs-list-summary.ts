import type { ApplicationOutcomeStatus, DecisionAnalysis } from "@prisma/client";
import { listApplyGuidanceFromDecisionOrMatch } from "@/lib/services/decision-service";
import { PIPELINE_TRACKING_STATUSES } from "@/lib/jobs-tracking-buckets";
import type { JobWithLatestForList } from "@/lib/services/jobs-list-bundle";
import type { NormalizedImpactMetrics } from "@/lib/types/impact-metrics";

export type JobsRowForSummary = {
  trackingStatus: ApplicationOutcomeStatus | null;
  /** Apply / Consider / Skip — same source as list badges; null when no defensible tier. */
  decisionListLabel: "Apply" | "Consider" | "Skip" | null;
};

export type JobsListSummary = {
  total: number;
  applyWorthy: number;
  applied: number;
  skipped: number;
  inPipeline: number;
};

/** Summary rows aligned with jobs list decision badges (persisted when current, else match). */
export function buildJobsFeedSummaryRows(
  jobs: JobWithLatestForList[],
  statusByJob: Map<string, ApplicationOutcomeStatus>,
  latestDecisionByJob: Map<string, DecisionAnalysis>,
  impactMetricIdByJob: Map<string, string | null>,
  normalizedImpactByJob: Map<string, NormalizedImpactMetrics | null>,
): JobsRowForSummary[] {
  return jobs.map((job) => {
    const latest = job.matchAnalyses[0];
    const persisted = latestDecisionByJob.get(job.id);
    const impactId = impactMetricIdByJob.get(job.id) ?? null;
    const impact = normalizedImpactByJob.get(job.id) ?? null;
    const g = listApplyGuidanceFromDecisionOrMatch(
      latest
        ? {
            id: latest.id,
            matchScore: latest.matchScore,
            verdict: latest.verdict,
            breakdown: latest.breakdown,
          }
        : null,
      persisted,
      impactId,
      impact,
    );
    return {
      trackingStatus: statusByJob.get(job.id) ?? null,
      decisionListLabel: g?.label ?? null,
    };
  });
}

/** Counts align with jobs list badges and tracking for the feed resume. */
export function computeJobsListSummary(rows: JobsRowForSummary[]): JobsListSummary {
  let applyWorthy = 0;
  let applied = 0;
  let skipped = 0;
  let inPipeline = 0;

  for (const row of rows) {
    if (row.decisionListLabel === "Apply") applyWorthy++;
    const s = row.trackingStatus;
    if (s === "applied") applied++;
    if (s === "skipped") skipped++;
    if (s != null && PIPELINE_TRACKING_STATUSES.includes(s)) inPipeline++;
  }

  return {
    total: rows.length,
    applyWorthy,
    applied,
    skipped,
    inPipeline,
  };
}
