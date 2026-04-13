import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRemoteOkJobs, mapRemoteOkRow, type RemoteOkRow } from "@/lib/integrations/remoteok";

const REMOTEOK_API = "https://remoteok.com/api";

function validApiRow(id: string): RemoteOkRow {
  return {
    id,
    slug: `${id}-slug`,
    position: "Software Engineer",
    company: "Acme",
    description: `<p>${"Building backend services with Node and TypeScript. ".repeat(2)}</p>`,
    url: `https://remoteok.com/remote-jobs/${id}-slug`,
    tags: ["node"],
  };
}

function mockJsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
    text: async () => "",
  } as Response;
}

describe("mapRemoteOkRow", () => {
  it("maps API row to NormalizedJob with stripped HTML and source remoteok", () => {
    const row: RemoteOkRow = {
      id: "remoteok-99",
      slug: "remoteok-99-acme",
      position: "Backend Engineer",
      company: "Acme",
      description: "<p>We need a <strong>software engineer</strong> with forty chars min here.</p>",
      url: "https://remoteok.com/remote-jobs/remoteok-99-acme",
      tags: ["python"],
    };
    const j = mapRemoteOkRow(row);
    expect(j).not.toBeNull();
    expect(j!.source).toBe("remoteok");
    expect(j!.externalId).toBe("remoteok-99");
    expect(j!.title).toBe("Backend Engineer");
    expect(j!.company).toBe("Acme");
    expect(j!.description).not.toContain("<");
    expect(j!.description.length).toBeGreaterThanOrEqual(40);
    expect(j!.applyUrl).toBe(row.url);
  });

  it("returns null when description is too short after strip", () => {
    const row: RemoteOkRow = {
      id: "1",
      slug: "1-x",
      position: "Engineer",
      company: "Co",
      description: "<p>short</p>",
      url: "https://remoteok.com/remote-jobs/1-x",
      tags: ["engineer"],
    };
    expect(mapRemoteOkRow(row)).toBeNull();
  });

  it("returns null when not CS-related", () => {
    const row: RemoteOkRow = {
      id: "2",
      slug: "2-x",
      position: "Office Manager",
      company: "Co",
      description: `${"x".repeat(50)} administrative work only no tech terms`,
      url: "https://remoteok.com/remote-jobs/2-x",
      tags: [],
    };
    expect(mapRemoteOkRow(row)).toBeNull();
  });

  it("returns null without id, slug, or buildable url", () => {
    const row: RemoteOkRow = {
      position: "Backend Engineer",
      company: "Co",
      description: `${"Building software systems. ".repeat(5)}`,
      tags: ["engineer"],
    };
    expect(mapRemoteOkRow(row)).toBeNull();
  });
});

describe("fetchRemoteOkJobs", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("calls Remote OK API, skips index 0, normalizes valid rows, drops filtered and non-objects", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockJsonResponse([
        validApiRow("ONLY_INDEX_ZERO"),
        validApiRow("KEEP_A"),
        {
          id: "SHORT",
          slug: "SHORT-s",
          position: "Engineer",
          company: "C",
          description: "<p>too short</p>",
          url: "https://remoteok.com/remote-jobs/SHORT-s",
          tags: ["engineer"],
        },
        validApiRow("KEEP_B"),
        "not-a-job-row" as unknown,
      ]),
    ) as typeof fetch;

    const jobs = await fetchRemoteOkJobs();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      REMOTEOK_API,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
          "User-Agent": expect.stringContaining("HireLens"),
        }),
        cache: "no-store",
      }),
    );

    expect(jobs.map((j) => j.externalId).sort()).toEqual(["KEEP_A", "KEEP_B"]);
    expect(jobs.every((j) => j.source === "remoteok")).toBe(true);
    const a = jobs.find((j) => j.externalId === "KEEP_A")!;
    expect(a.title).toBe("Software Engineer");
    expect(a.description).not.toContain("<");
    expect(a.applyUrl).toContain("remoteok.com");
  });

  it("index 0 is never ingested even if it is a valid job shape", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockJsonResponse([validApiRow("ROW_ZERO_ONLY"), validApiRow("ROW_ONE")]),
    ) as typeof fetch;

    const jobs = await fetchRemoteOkJobs();
    expect(jobs.map((j) => j.externalId)).toEqual(["ROW_ONE"]);
  });

  it("returns [] when payload is not an array or has fewer than 2 elements", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockJsonResponse({ jobs: [] })) as typeof fetch;
    await expect(fetchRemoteOkJobs()).resolves.toEqual([]);

    globalThis.fetch = vi.fn().mockResolvedValue(mockJsonResponse([])) as typeof fetch;
    await expect(fetchRemoteOkJobs()).resolves.toEqual([]);

    globalThis.fetch = vi.fn().mockResolvedValue(mockJsonResponse([{ legal: "only row" }])) as typeof fetch;
    await expect(fetchRemoteOkJobs()).resolves.toEqual([]);
  });

  it("throws on non-OK HTTP (reads body snippet)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => ({}),
      text: async () => "upstream failure",
    } as Response) as typeof fetch;

    await expect(fetchRemoteOkJobs()).rejects.toThrow(
      /Remote OK: API error 503 Service Unavailable — upstream failure/,
    );
  });

  it("throws when response body is not valid JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
      text: async () => "",
    } as unknown as Response) as typeof fetch;

    await expect(fetchRemoteOkJobs()).rejects.toThrow(/not valid JSON/);
  });

  it("throws when fetch rejects (network)", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as typeof fetch;

    await expect(fetchRemoteOkJobs()).rejects.toThrow(/request failed.*ECONNREFUSED/s);
  });

  it("stops after MAX_JOBS (10) normalized rows", async () => {
    const rows: unknown[] = [{ epoch: 0 }];
    for (let i = 0; i < 15; i++) {
      rows.push(validApiRow(`id-${i}`));
    }
    globalThis.fetch = vi.fn().mockResolvedValue(mockJsonResponse(rows)) as typeof fetch;

    const jobs = await fetchRemoteOkJobs();
    expect(jobs).toHaveLength(10);
    expect(jobs[0]!.externalId).toBe("id-0");
    expect(jobs[9]!.externalId).toBe("id-9");
  });
});
