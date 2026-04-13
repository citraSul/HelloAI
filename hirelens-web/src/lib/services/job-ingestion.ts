import type { Job } from "@prisma/client";
import { analyzeJobMock } from "@/lib/agents";
import { prisma } from "@/lib/db/prisma";
import { resolveUserId } from "@/lib/services/user";

export type UpsertJobFromFeedInput = {
  title: string;
  company?: string;
  description: string;
  source: string;
  externalId: string;
  applyUrl?: string;
  /** Same optional override as `analyzeJob` / other job services. */
  userId?: string;
};

/** Trim and normalize line endings for storage as `Job.rawDescription`. */
function normalizeDescription(description: string): string {
  return description.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

/**
 * Upsert a job from an external feed using `@@unique([userId, source, externalId])`.
 * Re-runs mock job analysis on create and update so feed rows match manual create behavior.
 */
export async function upsertJobFromFeed(input: UpsertJobFromFeedInput): Promise<Job> {
  const source = input.source.trim();
  const externalId = input.externalId.trim();
  const title = input.title.trim();
  const rawDescription = normalizeDescription(input.description);

  if (!title) {
    throw new Error("upsertJobFromFeed: title is required");
  }
  if (!source || !externalId) {
    throw new Error("upsertJobFromFeed: source and externalId must be non-empty");
  }
  if (!rawDescription) {
    throw new Error("upsertJobFromFeed: description is empty after normalization");
  }

  const userId = await resolveUserId(input.userId);
  const analyzedJson = (await analyzeJobMock(rawDescription)) as object;
  const company = input.company?.trim() ? input.company.trim() : null;
  const applyUrl = input.applyUrl?.trim() ? input.applyUrl.trim() : null;
  const fetchedAt = new Date();

  const job = await prisma.job.upsert({
    where: {
      userId_source_externalId: {
        userId,
        source,
        externalId,
      },
    },
    create: {
      userId,
      title,
      company,
      rawDescription,
      analyzedJson,
      source,
      externalId,
      applyUrl,
      fetchedAt,
    },
    update: {
      title,
      company,
      rawDescription,
      applyUrl,
      fetchedAt,
      analyzedJson,
    },
  });

  return job;
}
