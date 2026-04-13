import { parseResumeMock } from "@/lib/agents";
import { prisma } from "@/lib/db/prisma";
import { resolveUserId } from "@/lib/services/user";

export async function uploadResume(input: {
  title: string;
  rawText: string;
  userId?: string;
}) {
  const userId = await resolveUserId(input.userId);
  const parsed = await parseResumeMock(input.rawText);

  const resume = await prisma.resume.create({
    data: {
      userId,
      title: input.title,
      rawText: input.rawText,
      parsed: {
        create: { data: parsed as object },
      },
    },
    include: { parsed: true },
  });

  await prisma.agentRun.create({
    data: {
      userId,
      agentName: "resume_parser",
      inputJson: { title: input.title, length: input.rawText.length },
      outputJson: parsed as object,
      status: "ok",
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { primaryResumeId: true },
  });
  if (user && !user.primaryResumeId) {
    await prisma.user.update({
      where: { id: userId },
      data: { primaryResumeId: resume.id },
    });
  }

  return resume;
}

export async function setPrimaryResumeForUser(
  resumeId: string,
  explicitUserId?: string,
): Promise<{ ok: true }> {
  const userId = await resolveUserId(explicitUserId);
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId },
    select: { id: true },
  });
  if (!resume) {
    throw new Error("Resume not found");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { primaryResumeId: resumeId },
  });
  return { ok: true };
}
