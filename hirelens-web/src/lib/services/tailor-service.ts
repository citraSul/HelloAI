import { tailorResumeMock } from "@/lib/agents";
import { callFlaskPipeline } from "@/lib/flask/client";
import { isFlaskPipelineEnabled } from "@/lib/flask/env";
import { prisma } from "@/lib/db/prisma";
import { resolveUserId } from "@/lib/services/user";

export async function tailorResume(input: { resumeId: string; jobId: string; userId?: string }) {
  const userId = await resolveUserId(input.userId);

  const [resume, job] = await Promise.all([
    prisma.resume.findFirst({ where: { id: input.resumeId, userId } }),
    prisma.job.findFirst({ where: { id: input.jobId, userId } }),
  ]);

  if (!resume || !job) {
    throw new Error("Resume or job not found for user");
  }

  let content: string;
  let raw: unknown;

  if (isFlaskPipelineEnabled()) {
    const out = await callFlaskPipeline({
      job_description: job.rawDescription,
      resume: resume.rawText,
      include_tailoring: true,
      include_impact: false,
    });
    const tailored = out.tailoring?.tailored_resume;
    if (!tailored || !String(tailored).trim()) {
      throw new Error("Pipeline returned no tailored resume");
    }
    content = String(tailored);
    raw = out;
  } else {
    content = await tailorResumeMock(resume.rawText, job.title);
    raw = { length: content.length };
  }

  const tailoredRow = await prisma.tailoredResume.create({
    data: {
      userId,
      resumeId: resume.id,
      jobId: job.id,
      content,
    },
  });

  await prisma.agentRun.create({
    data: {
      userId,
      agentName: "resume_tailor",
      inputJson: { resumeId: resume.id, jobId: job.id, source: isFlaskPipelineEnabled() ? "flask" : "mock" },
      outputJson: raw as object,
      status: "ok",
    },
  });

  return tailoredRow;
}
