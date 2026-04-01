import { analyzeJobMock } from "@/lib/agents";
import { prisma } from "@/lib/db/prisma";
import { resolveUserId } from "@/lib/services/user";

export async function analyzeJob(input: {
  title: string;
  company?: string;
  rawDescription: string;
  userId?: string;
}) {
  const userId = await resolveUserId(input.userId);
  const analyzed = await analyzeJobMock(input.rawDescription);

  const job = await prisma.job.create({
    data: {
      userId,
      title: input.title,
      company: input.company ?? null,
      rawDescription: input.rawDescription,
      analyzedJson: analyzed as object,
    },
  });

  await prisma.agentRun.create({
    data: {
      userId,
      agentName: "job_analysis",
      inputJson: { title: input.title },
      outputJson: analyzed as object,
      status: "ok",
    },
  });

  return job;
}
