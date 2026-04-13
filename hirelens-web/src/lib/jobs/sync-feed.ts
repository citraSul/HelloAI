import { ingestJobs } from "@/lib/jobs/ingest";
import { upsertJobFromFeed } from "@/lib/services/job-ingestion";

export type JobFeedSyncError = {
  source: string;
  externalId: string;
  message: string;
};

export type JobFeedSyncSummary = {
  /** Rows returned from `ingestJobs()` after all ingest dedupe (= `ingestAfterCrossSource`). */
  fetched: number;
  /** Provider rows concatenated before any ingest dedupe. */
  ingestRawMerged: number;
  /** Row count after `source + externalId` dedupe. */
  ingestAfterSameSource: number;
  /** Row count after cross-source dedupe (matches `fetched`). */
  ingestAfterCrossSource: number;
  /** Rows removed by same-source dedupe. */
  ingestSameSourceDropped: number;
  /** Rows removed by cross-source dedupe. */
  ingestCrossSourceDropped: number;
  /** Rows with non-empty trimmed `description` (eligible for upsert). */
  valid: number;
  /** Rows skipped: empty description after trim. */
  skipped: number;
  /** Successful `upsertJobFromFeed` calls. */
  succeeded: number;
  /** Failed upserts (each recorded in `errors`). */
  failed: number;
  errors: JobFeedSyncError[];
};

/**
 * Fetches normalized jobs from all configured sources, then persists each valid row via Prisma.
 * One bad row does not abort the batch.
 */
export async function syncJobsFromFeeds(): Promise<JobFeedSyncSummary> {
  const { jobs: items, dedupe } = await ingestJobs();
  const fetched = items.length;

  const errors: JobFeedSyncError[] = [];
  let skipped = 0;
  let succeeded = 0;
  let failed = 0;

  for (const job of items) {
    if (!job.description.trim()) {
      skipped += 1;
      continue;
    }

    try {
      await upsertJobFromFeed({
        title: job.title,
        company: job.company,
        description: job.description,
        source: job.source,
        externalId: job.externalId,
        applyUrl: job.applyUrl,
      });
      succeeded += 1;
    } catch (e) {
      failed += 1;
      const message = e instanceof Error ? e.message : String(e);
      errors.push({
        source: job.source,
        externalId: job.externalId,
        message,
      });
    }
  }

  const valid = succeeded + failed;

  return {
    fetched,
    ingestRawMerged: dedupe.rawMerged,
    ingestAfterSameSource: dedupe.afterSameSource,
    ingestAfterCrossSource: dedupe.afterCrossSource,
    ingestSameSourceDropped: dedupe.sameSourceDropped,
    ingestCrossSourceDropped: dedupe.crossSourceDropped,
    valid,
    skipped,
    succeeded,
    failed,
    errors,
  };
}
