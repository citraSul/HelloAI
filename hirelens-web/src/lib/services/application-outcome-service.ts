import type { ApplicationOutcomeStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resolveUserId } from "@/lib/services/user";
import { toApplicationOutcomeDTO, type ApplicationOutcomeDTO } from "@/lib/types/application-outcome";

const now = () => new Date();

type TimestampFields = {
  appliedAt?: Date;
  respondedAt?: Date;
  interviewedAt?: Date;
  offeredAt?: Date;
  rejectedAt?: Date;
};

function timestampPatchForStatus(
  status: ApplicationOutcomeStatus,
  existing: {
    appliedAt: Date | null;
    respondedAt: Date | null;
    interviewedAt: Date | null;
    offeredAt: Date | null;
    rejectedAt: Date | null;
  },
): TimestampFields {
  const t = now();
  switch (status) {
    case "saved":
      return {};
    case "applied":
      return { appliedAt: t };
    case "responded":
      return {
        respondedAt: t,
        appliedAt: existing.appliedAt ?? t,
      };
    case "interviewed":
      return {
        interviewedAt: t,
        respondedAt: existing.respondedAt ?? t,
        appliedAt: existing.appliedAt ?? t,
      };
    case "offered":
      return {
        offeredAt: t,
        interviewedAt: existing.interviewedAt ?? t,
        respondedAt: existing.respondedAt ?? t,
        appliedAt: existing.appliedAt ?? t,
      };
    case "rejected":
      return {
        rejectedAt: t,
        appliedAt: existing.appliedAt ?? t,
      };
    case "skipped":
      return {};
    case "archived":
      return {};
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

async function assertJobResumeOwned(userId: string, jobId: string, resumeId: string) {
  const [job, resume] = await Promise.all([
    prisma.job.findFirst({ where: { id: jobId, userId }, select: { id: true } }),
    prisma.resume.findFirst({ where: { id: resumeId, userId }, select: { id: true } }),
  ]);
  if (!job) throw new Error("Job not found");
  if (!resume) throw new Error("Resume not found");
}

export async function getOutcomeForJobResume(
  userId: string,
  jobId: string,
  resumeId: string,
): Promise<ApplicationOutcomeDTO | null> {
  const row = await prisma.applicationOutcome.findUnique({
    where: { userId_jobId_resumeId: { userId, jobId, resumeId } },
  });
  return row ? toApplicationOutcomeDTO(row) : null;
}

export async function upsertApplicationOutcome(input: {
  userId?: string;
  jobId: string;
  resumeId: string;
  status: ApplicationOutcomeStatus;
  notes?: string;
}): Promise<ApplicationOutcomeDTO> {
  const userId = await resolveUserId(input.userId);
  await assertJobResumeOwned(userId, input.jobId, input.resumeId);

  const [latestTailored, latestDecision, existing] = await Promise.all([
    prisma.tailoredResume.findFirst({
      where: { userId, jobId: input.jobId, resumeId: input.resumeId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    }),
    prisma.decisionAnalysis.findFirst({
      where: { userId, jobId: input.jobId, resumeId: input.resumeId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    prisma.applicationOutcome.findUnique({
      where: { userId_jobId_resumeId: { userId, jobId: input.jobId, resumeId: input.resumeId } },
    }),
  ]);

  const ts = existing
    ? timestampPatchForStatus(input.status, {
        appliedAt: existing.appliedAt,
        respondedAt: existing.respondedAt,
        interviewedAt: existing.interviewedAt,
        offeredAt: existing.offeredAt,
        rejectedAt: existing.rejectedAt,
      })
    : timestampPatchForStatus(input.status, {
        appliedAt: null,
        respondedAt: null,
        interviewedAt: null,
        offeredAt: null,
        rejectedAt: null,
      });

  const row = await prisma.applicationOutcome.upsert({
    where: { userId_jobId_resumeId: { userId, jobId: input.jobId, resumeId: input.resumeId } },
    create: {
      userId,
      jobId: input.jobId,
      resumeId: input.resumeId,
      status: input.status,
      tailoredResumeId: latestTailored?.id ?? null,
      decisionAnalysisId: latestDecision?.id ?? null,
      notes: input.notes ?? null,
      source: "manual",
      ...ts,
    },
    update: {
      status: input.status,
      tailoredResumeId: latestTailored?.id ?? null,
      decisionAnalysisId: latestDecision?.id ?? null,
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...ts,
    },
  });

  return toApplicationOutcomeDTO(row);
}

export type OutcomeAnalytics = {
  funnelApplied: number;
  funnelResponded: number;
  funnelInterviewed: number;
  funnelOffered: number;
  countRejected: number;
  countByStatus: Record<string, number>;
  responseRate: number | null;
  interviewRate: number | null;
  offerRate: number | null;
};

export async function getOutcomeAnalyticsForUser(userId: string): Promise<OutcomeAnalytics> {
  const outcomes = await prisma.applicationOutcome.findMany({
    where: { userId },
    select: {
      status: true,
      appliedAt: true,
      respondedAt: true,
      interviewedAt: true,
      offeredAt: true,
      rejectedAt: true,
    },
  });

  const funnelApplied = outcomes.filter((o) => o.appliedAt != null).length;
  const funnelResponded = outcomes.filter((o) => o.respondedAt != null).length;
  const funnelInterviewed = outcomes.filter((o) => o.interviewedAt != null).length;
  const funnelOffered = outcomes.filter((o) => o.offeredAt != null).length;
  const countRejected = outcomes.filter((o) => o.rejectedAt != null || o.status === "rejected").length;

  const countByStatus: Record<string, number> = {};
  for (const o of outcomes) {
    countByStatus[o.status] = (countByStatus[o.status] ?? 0) + 1;
  }

  const responseRate = funnelApplied > 0 ? funnelResponded / funnelApplied : null;
  const interviewRate = funnelResponded > 0 ? funnelInterviewed / funnelResponded : null;
  const offerRate = funnelInterviewed > 0 ? funnelOffered / funnelInterviewed : null;

  return {
    funnelApplied,
    funnelResponded,
    funnelInterviewed,
    funnelOffered,
    countRejected,
    countByStatus,
    responseRate,
    interviewRate,
    offerRate,
  };
}

export type OutcomeInsight = { text: string };

/** Deterministic insights from stored outcomes + latest match per job/resume. */
export async function computeOutcomeInsights(userId: string): Promise<OutcomeInsight[]> {
  const outcomes = await prisma.applicationOutcome.findMany({
    where: { userId },
  });

  if (outcomes.length < 3) {
    return [{ text: "More outcome data is needed for personalized insights." }];
  }

  const insights: OutcomeInsight[] = [];
  const withResponse = outcomes.filter((o) => o.respondedAt != null);
  const appliedTotal = outcomes.filter((o) => o.appliedAt != null).length;

  if (appliedTotal >= 2 && withResponse.length > 0) {
    const responseRate = withResponse.length / appliedTotal;
    if (responseRate >= 0.4) {
      insights.push({
        text: `You are hearing back on about ${Math.round(responseRate * 100)}% of applications you marked — above typical noise for tracked roles.`,
      });
    }
  }

  const matches = await prisma.matchAnalysis.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 400,
    select: { jobId: true, resumeId: true, matchScore: true },
  });
  const key = (jobId: string, resumeId: string) => `${jobId}:${resumeId}`;
  const latestMatch = new Map<string, number>();
  for (const m of matches) {
    const k = key(m.jobId, m.resumeId);
    if (!latestMatch.has(k)) latestMatch.set(k, m.matchScore);
  }

  let nHigh = 0;
  let nLow = 0;
  let respHigh = 0;
  let respLow = 0;

  for (const o of outcomes) {
    if (!o.appliedAt) continue;
    const sc = latestMatch.get(key(o.jobId, o.resumeId));
    if (sc == null) continue;
    const responded = o.respondedAt != null;
    if (sc >= 0.72) {
      nHigh++;
      if (responded) respHigh++;
    } else {
      nLow++;
      if (responded) respLow++;
    }
  }

  if (nHigh >= 2 && nLow >= 2) {
    const rH = respHigh / nHigh;
    const rL = respLow / nLow;
    if (rH > rL + 0.15) {
      insights.push({
        text: "Jobs with higher match scores are converting to responses more often in your current data.",
      });
    }
  }

  const decisions = await prisma.decisionAnalysis.findMany({
    where: { userId, recommendation: "apply", confidence: "high" },
    take: 80,
    select: { jobId: true, resumeId: true },
  });
  let applyHighWithResponse = 0;
  let applyHighTotal = 0;
  for (const d of decisions) {
    const o = outcomes.find((x) => x.jobId === d.jobId && x.resumeId === d.resumeId);
    if (!o?.appliedAt) continue;
    applyHighTotal++;
    if (o.respondedAt) applyHighWithResponse++;
  }
  if (applyHighTotal >= 3 && applyHighWithResponse / applyHighTotal >= 0.35) {
    insights.push({
      text: "You are getting the most traction from jobs where HireLense recommended Apply with high confidence.",
    });
  }

  const resumeTitles = await prisma.resume.findMany({
    where: { userId },
    select: { id: true, title: true },
  });
  const titleById = new Map(resumeTitles.map((r) => [r.id, r.title]));
  const byResume = new Map<string, { responses: number; applied: number }>();
  for (const o of outcomes) {
    if (!o.appliedAt) continue;
    const cur = byResume.get(o.resumeId) ?? { responses: 0, applied: 0 };
    cur.applied++;
    if (o.respondedAt) cur.responses++;
    byResume.set(o.resumeId, cur);
  }
  let bestId: string | null = null;
  let bestRate = -1;
  for (const [rid, v] of byResume) {
    if (v.applied < 2) continue;
    const r = v.responses / v.applied;
    if (r > bestRate) {
      bestRate = r;
      bestId = rid;
    }
  }
  if (bestId && bestRate >= 0.4) {
    const t = titleById.get(bestId) ?? "one resume";
    insights.push({
      text: `“${t.slice(0, 48)}${t.length > 48 ? "…" : ""}” has the strongest response rate among your tracked applications.`,
    });
  }

  const backendKeywords = /\b(backend|platform|infrastructure|infra|devops|sre)\b/i;
  let backendApps = 0;
  let backendResp = 0;
  let generalApps = 0;
  let generalResp = 0;
  for (const o of outcomes) {
    if (!o.appliedAt) continue;
    const title = titleById.get(o.resumeId) ?? "";
    if (backendKeywords.test(title)) {
      backendApps++;
      if (o.respondedAt) backendResp++;
    } else {
      generalApps++;
      if (o.respondedAt) generalResp++;
    }
  }
  if (backendApps >= 2 && generalApps >= 2) {
    const rB = backendResp / backendApps;
    const rG = generalResp / generalApps;
    if (rB > rG + 0.12) {
      insights.push({
        text: "Backend- or platform-focused resume titles are associated with more responses than your other resumes in this dataset.",
      });
    }
  }

  if (insights.length === 0) {
    return [{ text: "More outcome data is needed for personalized insights." }];
  }
  return insights.slice(0, 4);
}

export async function getDashboardOutcomeSnapshot(userId: string) {
  const [analytics, recent, recordCount] = await Promise.all([
    getOutcomeAnalyticsForUser(userId),
    prisma.applicationOutcome.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: { job: { select: { title: true, company: true } } },
    }),
    prisma.applicationOutcome.count({ where: { userId } }),
  ]);

  return {
    recordCount,
    applicationsTracked: analytics.funnelApplied,
    interviews: analytics.funnelInterviewed,
    offers: analytics.funnelOffered,
    recent: recent.map((r) => ({
      id: r.id,
      label: r.job.company ? `${r.job.title} — ${r.job.company}` : r.job.title,
      status: r.status,
      at: r.updatedAt.toISOString(),
    })),
  };
}
