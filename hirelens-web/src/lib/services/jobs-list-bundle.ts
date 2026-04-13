import type { ApplicationOutcomeStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { defaultResumeIdFromList } from "@/lib/resume-default";

/** Same include as `/jobs` — latest match per job for list + summary. */
export const jobsListPageInclude = {
  matchAnalyses: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: { resume: { select: { title: true } } },
  },
} satisfies Prisma.JobInclude;

export type JobWithLatestForList = Prisma.JobGetPayload<{ include: typeof jobsListPageInclude }>;

/**
 * Jobs visible on `/jobs` (max 50) plus tracking status keyed by job id for the user’s default tracking resume.
 */
export async function fetchJobsListBundle(userId: string): Promise<{
  jobs: JobWithLatestForList[];
  statusByJob: Map<string, ApplicationOutcomeStatus>;
}> {
  const [jobRowsDb, userRow, resumes] = await Promise.all([
    prisma.job.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: jobsListPageInclude,
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { primaryResumeId: true },
    }),
    prisma.resume.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
      take: 50,
    }),
  ]);

  const statusByJob = new Map<string, ApplicationOutcomeStatus>();
  const trackResumeId = defaultResumeIdFromList(resumes, userRow?.primaryResumeId ?? null);
  if (trackResumeId && jobRowsDb.length > 0) {
    const outcomes = await prisma.applicationOutcome.findMany({
      where: {
        userId,
        resumeId: trackResumeId,
        jobId: { in: jobRowsDb.map((j) => j.id) },
      },
      select: { jobId: true, status: true },
    });
    for (const o of outcomes) {
      statusByJob.set(o.jobId, o.status);
    }
  }

  return { jobs: jobRowsDb, statusByJob };
}
