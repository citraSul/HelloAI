import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/adzuna", () => ({
  fetchAdzunaJobs: vi.fn(),
}));

vi.mock("@/lib/integrations/remoteok", () => ({
  fetchRemoteOkJobs: vi.fn(),
}));

import { fetchAdzunaJobs } from "@/lib/integrations/adzuna";
import { fetchRemoteOkJobs } from "@/lib/integrations/remoteok";
import { ingestJobs } from "@/lib/jobs/ingest";

const body = (c: string) => c.repeat(20);

describe("ingestJobs", () => {
  beforeEach(() => {
    vi.mocked(fetchAdzunaJobs).mockReset();
    vi.mocked(fetchRemoteOkJobs).mockReset();
  });

  it("calls both sources, merges results, and dedupes by source+externalId", async () => {
    vi.mocked(fetchAdzunaJobs).mockResolvedValue([
      {
        title: "A1",
        description: body("a"),
        source: "adzuna",
        externalId: "dup",
      },
      {
        title: "A2",
        description: body("b"),
        source: "adzuna",
        externalId: "dup",
      },
    ]);
    vi.mocked(fetchRemoteOkJobs).mockResolvedValue([
      {
        title: "R1",
        description: body("c"),
        source: "remoteok",
        externalId: "dup",
      },
    ]);

    const { jobs: out, dedupe } = await ingestJobs();

    expect(fetchAdzunaJobs).toHaveBeenCalledTimes(1);
    expect(fetchRemoteOkJobs).toHaveBeenCalledTimes(1);
    expect(out).toHaveLength(2);
    expect(out.filter((j) => j.source === "adzuna")).toHaveLength(1);
    expect(out.filter((j) => j.source === "remoteok")).toHaveLength(1);
    expect(dedupe).toEqual({
      rawMerged: 3,
      afterSameSource: 2,
      afterCrossSource: 2,
      sameSourceDropped: 1,
      crossSourceDropped: 0,
    });
  });

  it("continues when one source throws", async () => {
    const errLog = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetchAdzunaJobs).mockRejectedValue(new Error("adzuna down"));
    vi.mocked(fetchRemoteOkJobs).mockResolvedValue([
      { title: "R", description: body("z"), source: "remoteok", externalId: "1" },
    ]);

    const { jobs: out, dedupe } = await ingestJobs();
    expect(out).toHaveLength(1);
    expect(out[0]!.source).toBe("remoteok");
    expect(dedupe).toEqual({
      rawMerged: 1,
      afterSameSource: 1,
      afterCrossSource: 1,
      sameSourceDropped: 0,
      crossSourceDropped: 0,
    });
    errLog.mockRestore();
  });

  it("dedupes cross-source rows with the same canonical apply URL (first source wins)", async () => {
    vi.mocked(fetchAdzunaJobs).mockResolvedValue([
      {
        title: "Backend Engineer",
        description: body("a"),
        source: "adzuna",
        externalId: "a1",
        applyUrl: "https://Careers.example.com/apply/role-1/?utm_source=adzuna",
      },
    ]);
    vi.mocked(fetchRemoteOkJobs).mockResolvedValue([
      {
        title: "Different Wording",
        description: body("b"),
        source: "remoteok",
        externalId: "r9",
        applyUrl: "https://careers.example.com/apply/role-1#section",
      },
    ]);

    const { jobs: out, dedupe } = await ingestJobs();
    expect(out).toHaveLength(1);
    expect(out[0]!.source).toBe("adzuna");
    expect(out[0]!.externalId).toBe("a1");
    expect(dedupe).toEqual({
      rawMerged: 2,
      afterSameSource: 2,
      afterCrossSource: 1,
      sameSourceDropped: 0,
      crossSourceDropped: 1,
    });
  });

  it("dedupes cross-source rows without applyUrl when normalized title+company match and strings are long enough", async () => {
    const longTitle = "Senior Platform Engineer Backend Systems";
    vi.mocked(fetchAdzunaJobs).mockResolvedValue([
      {
        title: longTitle,
        company: "Acme Corp",
        description: body("a"),
        source: "adzuna",
        externalId: "1",
      },
    ]);
    vi.mocked(fetchRemoteOkJobs).mockResolvedValue([
      {
        title: `  ${longTitle.toUpperCase()}  `,
        company: "acme   corp",
        description: body("b"),
        source: "remoteok",
        externalId: "2",
      },
    ]);

    const { jobs: out, dedupe } = await ingestJobs();
    expect(out).toHaveLength(1);
    expect(out[0]!.source).toBe("adzuna");
    expect(dedupe.crossSourceDropped).toBe(1);
  });

  it("does not dedupe cross-source by title+company when title is below minimum length", async () => {
    vi.mocked(fetchAdzunaJobs).mockResolvedValue([
      {
        title: "Short Title Eng",
        company: "Acme",
        description: body("a"),
        source: "adzuna",
        externalId: "1",
      },
    ]);
    vi.mocked(fetchRemoteOkJobs).mockResolvedValue([
      {
        title: "Short Title Eng",
        company: "Acme",
        description: body("b"),
        source: "remoteok",
        externalId: "2",
      },
    ]);

    const { jobs: out, dedupe } = await ingestJobs();
    expect(out).toHaveLength(2);
    expect(dedupe.crossSourceDropped).toBe(0);
  });

  it("keeps cross-source rows when canonical apply URLs differ", async () => {
    const t = "Senior Data Engineer Pipeline Expert Role";
    vi.mocked(fetchAdzunaJobs).mockResolvedValue([
      {
        title: t,
        company: "Co",
        description: body("a"),
        source: "adzuna",
        externalId: "1",
        applyUrl: "https://jobs.example.com/a",
      },
    ]);
    vi.mocked(fetchRemoteOkJobs).mockResolvedValue([
      {
        title: t,
        company: "Co",
        description: body("b"),
        source: "remoteok",
        externalId: "2",
        applyUrl: "https://jobs.example.com/b",
      },
    ]);

    const { jobs, dedupe } = await ingestJobs();
    expect(jobs).toHaveLength(2);
    expect(dedupe.afterCrossSource).toBe(2);
    expect(dedupe.sameSourceDropped).toBe(0);
    expect(dedupe.crossSourceDropped).toBe(0);
  });
});
