import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/jobs/sync-feed", () => ({
  syncJobsFromFeeds: vi.fn(),
}));

import { GET, POST } from "@/app/api/jobs/ingest/route";
import { syncJobsFromFeeds } from "@/lib/jobs/sync-feed";

const SECRET = "test-cron-secret-for-vitest-xyz";

const sampleSummary = {
  fetched: 2,
  ingestRawMerged: 4,
  ingestAfterSameSource: 3,
  ingestAfterCrossSource: 2,
  ingestSameSourceDropped: 1,
  ingestCrossSourceDropped: 1,
  valid: 2,
  skipped: 0,
  succeeded: 2,
  failed: 0,
  errors: [] as { source: string; externalId: string; message: string }[],
};

describe("POST /api/jobs/ingest", () => {
  let prevCron: string | undefined;

  beforeEach(() => {
    prevCron = process.env.CRON_SECRET;
    process.env.CRON_SECRET = SECRET;
    vi.mocked(syncJobsFromFeeds).mockReset();
    vi.mocked(syncJobsFromFeeds).mockResolvedValue(sampleSummary);
  });

  afterEach(() => {
    if (prevCron === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = prevCron;
    }
  });

  it("returns 503 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(
      new Request("http://localhost/api/jobs/ingest", {
        method: "POST",
        headers: { "X-Cron-Secret": SECRET },
      }),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/CRON_SECRET/i);
    expect(syncJobsFromFeeds).not.toHaveBeenCalled();
  });

  it("returns 401 when token is missing", async () => {
    const res = await POST(new Request("http://localhost/api/jobs/ingest", { method: "POST" }));
    expect(res.status).toBe(401);
    expect(syncJobsFromFeeds).not.toHaveBeenCalled();
  });

  it("returns 401 when token is wrong", async () => {
    const res = await POST(
      new Request("http://localhost/api/jobs/ingest", {
        method: "POST",
        headers: { "X-Cron-Secret": "wrong-secret" },
      }),
    );
    expect(res.status).toBe(401);
    expect(syncJobsFromFeeds).not.toHaveBeenCalled();
  });

  it("accepts X-Cron-Secret and returns summary JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/jobs/ingest", {
        method: "POST",
        headers: { "X-Cron-Secret": SECRET },
      }),
    );
    expect(res.status).toBe(200);
    expect(syncJobsFromFeeds).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body).toEqual(sampleSummary);
  });

  it("accepts Authorization: Bearer token", async () => {
    const res = await POST(
      new Request("http://localhost/api/jobs/ingest", {
        method: "POST",
        headers: { Authorization: `Bearer ${SECRET}` },
      }),
    );
    expect(res.status).toBe(200);
    expect(syncJobsFromFeeds).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when sync throws", async () => {
    const errLog = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(syncJobsFromFeeds).mockRejectedValueOnce(new Error("boom"));
    const res = await POST(
      new Request("http://localhost/api/jobs/ingest", {
        method: "POST",
        headers: { "X-Cron-Secret": SECRET },
      }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("boom");
    errLog.mockRestore();
  });
});

describe("GET /api/jobs/ingest", () => {
  it("returns 405", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });
});
