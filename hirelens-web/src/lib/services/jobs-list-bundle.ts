import type { ApplicationOutcomeStatus, DecisionAnalysis, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { defaultResumeIdFromList } from "@/lib/resume-default";
import { rankJobsForFeed, type JobsFeedSort } from "@/lib/jobs-feed-rank";
import { normalizeImpactMetrics } from "@/lib/services/normalize-impact-metrics";
import {
  feedTierFromListGuidance,
  listApplyGuidanceFromDecisionOrMatch,
} from "@/lib/services/decision-service";
import type { NormalizedImpactMetrics } from "@/lib/types/impact-metrics";

/** Max jobs loaded before ranking (then sliced to DISPLAY_LIMIT). */
export const JOBS_FEED_RANK_POOL = 250;
export const JOBS_FEED_DISPLAY_LIMIT = 50;

const matchListInclude = {
  resume: { select: { title: true } },
} satisfies Prisma.MatchAnalysisInclude;

export type JobWithLatestForList = Prisma.JobGetPayload<{
  include: {
    matchAnalyses: {
      include: typeof matchListInclude;
    };
  };
}>;

export type JobsFeedContext = {
  resumeId: string | null;
  resumeTitle: string | null;
  /** True when the feed resume is the user’s saved primary. */
  usedPrimaryResume: boolean;
  hasAnyResume: boolean;
};

export type JobsFeedBundle = {
  jobs: JobWithLatestForList[];
  statusByJob: Map<string, ApplicationOutcomeStatus>;
  feedContext: JobsFeedContext;
  /** Latest persisted decision per job for the feed resume (deduped in JS). */
  latestDecisionByJob: Map<string, DecisionAnalysis>;
  /** Latest impact metric id per job for that resume’s current tailored row (or null). */
  impactMetricIdByJob: Map<string, string | null>;
  /** Normalized impact for the same row as `impactMetricIdByJob` (or null). */
  normalizedImpactByJob: Map<string, NormalizedImpactMetrics | null>;
};

async function loadDecisionImpactMaps(
  userId: string,
  feedResumeId: string,
  jobIds: string[],
  into: {
    latestDecisionByJob: Map<string, DecisionAnalysis>;
    impactMetricIdByJob: Map<string, string | null>;
    normalizedImpactByJob: Map<string, NormalizedImpactMetrics | null>;
  },
): Promise<void> {
  if (jobIds.length === 0) return;

  const [decisions, tailoredRows] = await Promise.all([
    prisma.decisionAnalysis.findMany({
      where: { userId, resumeId: feedResumeId, jobId: { in: jobIds } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tailoredResume.findMany({
      where: { userId, resumeId: feedResumeId, jobId: { in: jobIds } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  for (const d of decisions) {
    if (!into.latestDecisionByJob.has(d.jobId)) into.latestDecisionByJob.set(d.jobId, d);
  }

  const tailoredByJob = new Map<string, string>();
  for (const t of tailoredRows) {
    if (!tailoredByJob.has(t.jobId)) tailoredByJob.set(t.jobId, t.id);
  }
  const tailoredIds = [...new Set(tailoredByJob.values())];
  if (tailoredIds.length > 0) {
    const impacts = await prisma.impactMetric.findMany({
      where: { userId, tailoredResumeId: { in: tailoredIds } },
      orderBy: { createdAt: "desc" },
    });
    const latestImByTailored = new Map<string, (typeof impacts)[number]>();
    for (const im of impacts) {
      if (!latestImByTailored.has(im.tailoredResumeId)) {
        latestImByTailored.set(im.tailoredResumeId, im);
      }
    }
    for (const jid of jobIds) {
      const tid = tailoredByJob.get(jid);
      const row = tid ? latestImByTailored.get(tid) : undefined;
      into.impactMetricIdByJob.set(jid, row?.id ?? null);
      into.normalizedImpactByJob.set(jid, row ? normalizeImpactMetrics(row.metrics) : null);
    }
  } else {
    for (const jid of jobIds) {
      into.impactMetricIdByJob.set(jid, null);
      into.normalizedImpactByJob.set(jid, null);
    }
  }
}

/**
 * Jobs for `/jobs`: ranked pool, match + tracking scoped to the same resume
 * (primary when set and valid, otherwise newest updated resume).
 */
export async function fetchJobsListBundle(
  userId: string,
  opts?: { sort?: JobsFeedSort },
): Promise<JobsFeedBundle> {
  const sort = opts?.sort ?? "fit";

  const [userRow, resumes, jobRowsRaw] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { primaryResumeId: true },
    }),
    prisma.resume.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true },
      take: 50,
    }),
    prisma.job.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: JOBS_FEED_RANK_POOL,
    }),
  ]);

  const feedResumeId = defaultResumeIdFromList(resumes, userRow?.primaryResumeId ?? null);
  const feedResumeRow = feedResumeId ? resumes.find((r) => r.id === feedResumeId) : undefined;
  const usedPrimaryResume = Boolean(
    feedResumeId && userRow?.primaryResumeId && userRow.primaryResumeId === feedResumeId,
  );

  const feedContext: JobsFeedContext = {
    resumeId: feedResumeId ?? null,
    resumeTitle: feedResumeRow?.title?.trim() ?? null,
    usedPrimaryResume,
    hasAnyResume: resumes.length > 0,
  };

  const jobIds = jobRowsRaw.map((j) => j.id);
  const analyses =
    feedResumeId && jobIds.length > 0
      ? await prisma.matchAnalysis.findMany({
          where: { userId, resumeId: feedResumeId, jobId: { in: jobIds } },
          orderBy: { createdAt: "desc" },
          include: matchListInclude,
        })
      : [];

  const latestByJob = new Map<string, (typeof analyses)[number]>();
  for (const a of analyses) {
    if (!latestByJob.has(a.jobId)) latestByJob.set(a.jobId, a);
  }

  const jobsWithMatches: JobWithLatestForList[] = jobRowsRaw.map((job) => {
    const m = latestByJob.get(job.id);
    return {
      ...job,
      matchAnalyses: m ? [m] : [],
    } as JobWithLatestForList;
  });

  const latestDecisionByJob = new Map<string, DecisionAnalysis>();
  const impactMetricIdByJob = new Map<string, string | null>();
  const normalizedImpactByJob = new Map<string, NormalizedImpactMetrics | null>();

  const needsPoolDecisions = sort === "fit" && Boolean(feedResumeId) && jobIds.length > 0;
  if (needsPoolDecisions) {
    await loadDecisionImpactMaps(userId, feedResumeId!, jobIds, {
      latestDecisionByJob,
      impactMetricIdByJob,
      normalizedImpactByJob,
    });
  }

  const feedSortKey = (job: JobWithLatestForList) => {
    const latest = job.matchAnalyses[0];
    const g = listApplyGuidanceFromDecisionOrMatch(
      latest
        ? {
            id: latest.id,
            matchScore: latest.matchScore,
            verdict: latest.verdict,
            breakdown: latest.breakdown,
          }
        : null,
      latestDecisionByJob.get(job.id),
      impactMetricIdByJob.get(job.id) ?? null,
      normalizedImpactByJob.get(job.id) ?? null,
    );
    return {
      tier: feedTierFromListGuidance(g),
      matchScore: latest?.matchScore ?? 0,
      updatedAtMs: job.updatedAt.getTime(),
    };
  };

  const ranked =
    sort === "fit"
      ? rankJobsForFeed(jobsWithMatches, sort, feedSortKey).slice(0, JOBS_FEED_DISPLAY_LIMIT)
      : rankJobsForFeed(jobsWithMatches, sort).slice(0, JOBS_FEED_DISPLAY_LIMIT);

  const jobIdsRanked = ranked.map((j) => j.id);
  const statusByJob = new Map<string, ApplicationOutcomeStatus>();

  if (!needsPoolDecisions && feedResumeId && jobIdsRanked.length > 0) {
    await loadDecisionImpactMaps(userId, feedResumeId, jobIdsRanked, {
      latestDecisionByJob,
      impactMetricIdByJob,
      normalizedImpactByJob,
    });
  }

  if (feedResumeId && jobIdsRanked.length > 0) {
    const outcomes = await prisma.applicationOutcome.findMany({
      where: {
        userId,
        resumeId: feedResumeId,
        jobId: { in: jobIdsRanked },
      },
      select: { jobId: true, status: true },
    });
    for (const o of outcomes) {
      statusByJob.set(o.jobId, o.status);
    }
  }

  return {
    jobs: ranked,
    statusByJob,
    feedContext,
    latestDecisionByJob,
    impactMetricIdByJob,
    normalizedImpactByJob,
  };
}
