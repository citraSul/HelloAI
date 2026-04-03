import type { ApplicationOutcomeStatus } from "@prisma/client";

export type { ApplicationOutcomeStatus };

export type ApplicationOutcomeDTO = {
  id: string;
  userId: string;
  jobId: string;
  resumeId: string;
  tailoredResumeId: string | null;
  decisionAnalysisId: string | null;
  status: ApplicationOutcomeStatus;
  appliedAt: string | null;
  respondedAt: string | null;
  interviewedAt: string | null;
  offeredAt: string | null;
  rejectedAt: string | null;
  notes: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toApplicationOutcomeDTO(row: {
  id: string;
  userId: string;
  jobId: string;
  resumeId: string;
  tailoredResumeId: string | null;
  decisionAnalysisId: string | null;
  status: ApplicationOutcomeStatus;
  appliedAt: Date | null;
  respondedAt: Date | null;
  interviewedAt: Date | null;
  offeredAt: Date | null;
  rejectedAt: Date | null;
  notes: string | null;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ApplicationOutcomeDTO {
  return {
    id: row.id,
    userId: row.userId,
    jobId: row.jobId,
    resumeId: row.resumeId,
    tailoredResumeId: row.tailoredResumeId,
    decisionAnalysisId: row.decisionAnalysisId,
    status: row.status,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    respondedAt: row.respondedAt?.toISOString() ?? null,
    interviewedAt: row.interviewedAt?.toISOString() ?? null,
    offeredAt: row.offeredAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    notes: row.notes,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
