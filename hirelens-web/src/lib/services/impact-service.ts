import { evaluateImpactMock } from "@/lib/agents";
import { callFlaskEvaluateImpact } from "@/lib/flask/client";
import { isFlaskPipelineEnabled } from "@/lib/flask/env";
import { matchLevelLabel } from "@/lib/flask/normalize";
import { prisma } from "@/lib/db/prisma";
import { normalizeImpactMetrics } from "@/lib/services/normalize-impact-metrics";
import { resolveUserId } from "@/lib/services/user";

export async function evaluateImpact(input: { tailoredResumeId: string; userId?: string }) {
  const userId = await resolveUserId(input.userId);

  const tailored = await prisma.tailoredResume.findFirst({
    where: { id: input.tailoredResumeId, userId },
  });

  if (!tailored) {
    throw new Error("Tailored resume not found");
  }

  const [job, resume, analysis] = await Promise.all([
    prisma.job.findFirst({ where: { id: tailored.jobId, userId } }),
    prisma.resume.findFirst({ where: { id: tailored.resumeId, userId } }),
    prisma.matchAnalysis.findFirst({
      where: { resumeId: tailored.resumeId, jobId: tailored.jobId, userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!job || !resume) {
    throw new Error("Related job or resume not found");
  }

  let raw: unknown;

  if (isFlaskPipelineEnabled()) {
    const match_result =
      analysis != null
        ? {
            correlated_score: Math.round(analysis.matchScore * 1000) / 10,
            match_level: matchLevelLabel(analysis.verdict),
          }
        : undefined;
    raw = await callFlaskEvaluateImpact({
      job_description: job.rawDescription,
      original_resume: resume.rawText,
      tailored_resume: tailored.content,
      match_result,
    });
  } else {
    raw = await evaluateImpactMock({
      originalResume: resume.rawText,
      tailoredResume: tailored.content,
      jobDescription: job.rawDescription,
    });
  }

  const metrics = normalizeImpactMetrics(raw);

  const row = await prisma.impactMetric.create({
    data: {
      userId,
      tailoredResumeId: tailored.id,
      metrics: metrics as object,
    },
  });

  await prisma.agentRun.create({
    data: {
      userId,
      agentName: "impact_eval",
      inputJson: { tailoredResumeId: tailored.id, source: isFlaskPipelineEnabled() ? "flask" : "mock" },
      outputJson: metrics as object,
      status: "ok",
    },
  });

  return row;
}
