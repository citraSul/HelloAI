import { scoreMatchMock } from "@/lib/agents";
import { callFlaskPipeline } from "@/lib/flask/client";
import { isFlaskPipelineEnabled } from "@/lib/flask/env";
import { matchScoreToUnit, normalizeMatchComponents, normalizeVerdict } from "@/lib/flask/normalize";
import { prisma } from "@/lib/db/prisma";
import { resolveUserId } from "@/lib/services/user";

export async function scoreMatch(input: { resumeId: string; jobId: string; userId?: string }) {
  const userId = await resolveUserId(input.userId);

  const [resume, job] = await Promise.all([
    prisma.resume.findFirst({ where: { id: input.resumeId, userId } }),
    prisma.job.findFirst({ where: { id: input.jobId, userId } }),
  ]);

  if (!resume || !job) {
    throw new Error("Resume or job not found for user");
  }

  let scored: {
    matchScore: number;
    verdict: string;
    breakdown: Record<string, unknown>;
    raw?: unknown;
  };

  if (isFlaskPipelineEnabled()) {
    const out = await callFlaskPipeline({
      job_description: job.rawDescription,
      resume: resume.rawText,
      include_tailoring: false,
      include_impact: false,
    });
    const ma = out.match_analysis;
    if (!ma || typeof ma.match_score !== "number") {
      throw new Error("Invalid pipeline response: missing match_analysis");
    }
    scored = {
      matchScore: matchScoreToUnit(ma.match_score),
      verdict: normalizeVerdict(String(ma.verdict || "weak")),
      breakdown: {
        ...normalizeMatchComponents(out.match_components || undefined),
        strengths: ma.strengths,
        gaps: ma.gaps,
        reasoning: ma.reasoning,
      },
      raw: out,
    };

    if (out.job_data != null) {
      await prisma.job.update({
        where: { id: job.id },
        data: { analyzedJson: out.job_data as object },
      });
    }
    if (out.resume_data != null) {
      await prisma.parsedResumeProfile.upsert({
        where: { resumeId: resume.id },
        create: { resumeId: resume.id, data: out.resume_data as object },
        update: { data: out.resume_data as object },
      });
    }
  } else {
    const mock = await scoreMatchMock({
      resumeText: resume.rawText,
      jobDescription: job.rawDescription,
    });
    scored = {
      matchScore: mock.matchScore,
      verdict: mock.verdict,
      breakdown: mock.breakdown as Record<string, unknown>,
    };
  }

  const analysis = await prisma.matchAnalysis.create({
    data: {
      userId,
      resumeId: resume.id,
      jobId: job.id,
      matchScore: scored.matchScore,
      verdict: scored.verdict,
      breakdown: scored.breakdown as object,
    },
  });

  await prisma.agentRun.create({
    data: {
      userId,
      agentName: "match_scoring",
      inputJson: { resumeId: resume.id, jobId: job.id, source: isFlaskPipelineEnabled() ? "flask" : "mock" },
      outputJson: (scored.raw ?? scored) as object,
      status: "ok",
    },
  });

  return analysis;
}
