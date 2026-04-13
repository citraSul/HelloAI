import type { Job } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/jobs/ingest", () => ({
  ingestJobs: vi.fn(),
}));

vi.mock("@/lib/services/job-ingestion", () => ({
  upsertJobFromFeed: vi.fn(),
}));

import { ingestJobs } from "@/lib/jobs/ingest";
import { upsertJobFromFeed } from "@/lib/services/job-ingestion";
import { syncJobsFromFeeds } from "@/lib/jobs/sync-feed";

const stubJob = { id: "job-1" } as Job;

describe("syncJobsFromFeeds", () => {
  beforeEach(() => {
    vi.mocked(ingestJobs).mockReset();
    vi.mocked(upsertJobFromFeed).mockReset();
  });

  it("counts skipped, succeeded, and failed without aborting the batch", async () => {
    vi.mocked(ingestJobs).mockResolvedValue({
      jobs: [
        {
          title: "Skip me",
          description: "   ",
          source: "adzuna",
          externalId: "1",
        },
        {
          title: "OK",
          description: "body",
          source: "adzuna",
          externalId: "2",
        },
        {
          title: "Fail",
          description: "body",
          source: "adzuna",
          externalId: "3",
        },
      ],
      dedupe: {
        rawMerged: 5,
        afterSameSource: 3,
        afterCrossSource: 3,
        sameSourceDropped: 2,
        crossSourceDropped: 0,
      },
    });

    vi.mocked(upsertJobFromFeed)
      .mockResolvedValueOnce(stubJob)
      .mockRejectedValueOnce(new Error("db down"));

    const s = await syncJobsFromFeeds();

    expect(s.fetched).toBe(3);
    expect(s.ingestRawMerged).toBe(5);
    expect(s.ingestAfterSameSource).toBe(3);
    expect(s.ingestAfterCrossSource).toBe(3);
    expect(s.ingestSameSourceDropped).toBe(2);
    expect(s.ingestCrossSourceDropped).toBe(0);
    expect(s.fetched).toBe(s.ingestAfterCrossSource);
    expect(s.skipped).toBe(1);
    expect(s.valid).toBe(2);
    expect(s.succeeded).toBe(1);
    expect(s.failed).toBe(1);
    expect(s.errors).toEqual([
      { source: "adzuna", externalId: "3", message: "db down" },
    ]);
    expect(vi.mocked(upsertJobFromFeed)).toHaveBeenCalledTimes(2);
  });
});
