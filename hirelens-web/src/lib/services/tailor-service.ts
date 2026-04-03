import { assertRealModePipelineConfigured } from "@/lib/config/app-mode";
import { tailorResumeMock } from "@/lib/agents";
import { callFlaskPipeline } from "@/lib/flask/client";
import { isFlaskPipelineEnabled } from "@/lib/flask/env";
import { prisma } from "@/lib/db/prisma";
import { resolveUserId } from "@/lib/services/user";
import type { TailoredResume } from "@prisma/client";

export type TailorChangeEntry = {
  section: string;
  summary: string;
  detail?: string;
};

export type TailorResultMeta = {
  jobTitle: string;
  company: string | null;
  originalText: string;
  tailoredText: string;
  changeLog: TailorChangeEntry[];
  warnings: string[];
};

function extractTailoringMeta(raw: unknown): { changeLog: TailorChangeEntry[]; warnings: string[] } {
  if (!raw || typeof raw !== "object") return { changeLog: [], warnings: [] };
  const o = raw as Record<string, unknown>;
  const tailoring = o.tailoring as Record<string, unknown> | undefined;
  if (!tailoring) return { changeLog: [], warnings: [] };
  const changes = tailoring.changes as Array<Record<string, unknown>> | undefined;
  const warnings = tailoring.warnings as string[] | undefined;
  const changeLog: TailorChangeEntry[] = (changes ?? []).map((c) => ({
    section: String(c.section ?? "section"),
    summary: String(c.reason ?? "Change"),
    detail:
      c.before || c.after
        ? `${String(c.before ?? "").slice(0, 200)}${c.before && c.after ? " → " : ""}${String(c.after ?? "").slice(0, 200)}`
        : undefined,
  }));
  return { changeLog, warnings: warnings ?? [] };
}

export async function tailorResume(input: { resumeId: string; jobId: string; userId?: string }): Promise<{
  tailored: TailoredResume;
  meta: TailorResultMeta;
}> {
  const userId = await resolveUserId(input.userId);

  const [resume, job] = await Promise.all([
    prisma.resume.findFirst({ where: { id: input.resumeId, userId } }),
    prisma.job.findFirst({ where: { id: input.jobId, userId } }),
  ]);

  if (!resume || !job) {
    throw new Error("Resume or job not found for user");
  }

  assertRealModePipelineConfigured();

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
    const mockResult = await tailorResumeMock(resume.rawText, job.title, {
      company: job.company,
      jobDescription: job.rawDescription,
    });
    content = mockResult.tailoredText;
    raw = { length: content.length, mockChangeLog: mockResult.changeLog };
  }

  const { changeLog, warnings } = extractTailoringMeta(raw);
  const mockChangeLog =
    !isFlaskPipelineEnabled() && raw && typeof raw === "object" && "mockChangeLog" in raw
      ? (raw as { mockChangeLog: TailorChangeEntry[] }).mockChangeLog
      : [];

  const syntheticLog: TailorChangeEntry[] =
    changeLog.length > 0
      ? changeLog
      : mockChangeLog.length > 0
        ? mockChangeLog
        : content.trim() !== resume.rawText.trim()
          ? [
              {
                section: "document",
                summary: "Resume adjusted for target role (mock tailoring).",
                detail: "Compare center column for highlighted edits.",
              },
            ]
          : [];

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

  return {
    tailored: tailoredRow,
    meta: {
      jobTitle: job.title,
      company: job.company,
      originalText: resume.rawText,
      tailoredText: content,
      changeLog: syntheticLog,
      warnings,
    },
  };
}
