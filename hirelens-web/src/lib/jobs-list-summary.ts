import type { ApplicationOutcomeStatus } from "@prisma/client";
import { quickApplyGuidanceFromMatch } from "@/lib/services/decision-service";
import { PIPELINE_TRACKING_STATUSES } from "@/lib/jobs-tracking-buckets";
import type { JobWithLatestForList } from "@/lib/services/jobs-list-bundle";

export type JobsRowForSummary = {
  latest: { matchScore: number; verdict: string } | null;
  trackingStatus: ApplicationOutcomeStatus | null;
};

export type JobsListSummary = {
  total: number;
  applyWorthy: number;
  applied: number;
  skipped: number;
  inPipeline: number;
};

/** Maps `/jobs` bundle rows to summary inputs (same shape as list VM fields used for counts). */
export function jobsFromBundleToSummaryRows(
  jobs: JobWithLatestForList[],
  statusByJob: Map<string, ApplicationOutcomeStatus>,
): JobsRowForSummary[] {
  return jobs.map((job) => {
    const latest = job.matchAnalyses[0];
    return {
      latest: latest ? { matchScore: latest.matchScore, verdict: latest.verdict } : null,
      trackingStatus: statusByJob.get(job.id) ?? null,
    };
  });
}

/** Counts align with jobs list row VM: decision from latest match; tracking from default resume. */
export function computeJobsListSummary(rows: JobsRowForSummary[]): JobsListSummary {
  let applyWorthy = 0;
  let applied = 0;
  let skipped = 0;
  let inPipeline = 0;

  for (const row of rows) {
    if (row.latest) {
      const { label } = quickApplyGuidanceFromMatch(row.latest.matchScore, row.latest.verdict);
      if (label === "Apply") applyWorthy++;
    }
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
