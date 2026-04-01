import { prisma } from "@/lib/db/prisma";
import type { DashboardOverview } from "@/types";
import { resolveUserId } from "@/lib/services/user";

export async function getDashboardOverview(userId?: string): Promise<DashboardOverview> {
  const uid = await resolveUserId(userId);

  const [jobCount, resumeCount, analyses, lastRun] = await Promise.all([
    prisma.job.count({ where: { userId: uid } }),
    prisma.resume.count({ where: { userId: uid } }),
    prisma.matchAnalysis.findMany({
      where: { userId: uid },
      select: { matchScore: true },
    }),
    prisma.agentRun.findFirst({
      where: { userId: uid },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const avg =
    analyses.length === 0
      ? 0
      : analyses.reduce((s, a) => s + a.matchScore, 0) / analyses.length;

  const recent = await prisma.agentRun.findMany({
    where: { userId: uid },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return {
    activeJobs: jobCount,
    resumesIndexed: resumeCount,
    avgMatchScore: Math.round(avg * 100) / 100,
    lastRunAt: lastRun?.createdAt.toISOString() ?? null,
    recentActivity: recent.map((r) => ({
      id: r.id,
      label: `${r.agentName} · ${r.status}`,
      at: r.createdAt.toISOString(),
    })),
  };
}
