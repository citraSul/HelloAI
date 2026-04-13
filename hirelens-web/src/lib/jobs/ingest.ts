import { fetchAdzunaJobs } from "@/lib/integrations/adzuna";
import { fetchRemoteOkJobs } from "@/lib/integrations/remoteok";
import type { NormalizedJob } from "@/lib/jobs/types";

type JobSourceFetcher = () => Promise<NormalizedJob[]>;

/** Counts after merging provider batches, before/after each dedupe pass (orchestration observability). */
export type IngestDedupeStats = {
  rawMerged: number;
  afterSameSource: number;
  afterCrossSource: number;
  sameSourceDropped: number;
  crossSourceDropped: number;
};

export type IngestJobsResult = {
  jobs: NormalizedJob[];
  dedupe: IngestDedupeStats;
};

const sources: JobSourceFetcher[] = [fetchAdzunaJobs, fetchRemoteOkJobs];

function dedupeBySourceAndExternalId(jobs: NormalizedJob[]): NormalizedJob[] {
  const seen = new Set<string>();
  const out: NormalizedJob[] = [];
  for (const job of jobs) {
    const key = `${job.source}\0${job.externalId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(job);
  }
  return out;
}

/** Lowercase, trim, collapse internal whitespace (titles / company names). */
function normalizeLabel(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Origin + path only, no query/hash, trailing slash stripped (except root).
 * Returns null if missing or not parseable as an absolute URL.
 */
function crossSourceCanonicalApplyUrl(applyUrl: string | undefined): string | null {
  const raw = applyUrl?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.host.toLowerCase();
    let path = u.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    return `${u.protocol}//${host}${path}`;
  } catch {
    return null;
  }
}

const MIN_TITLE_LEN_TITLE_COMPANY_DEDUPE = 24;
const MIN_COMPANY_LEN_TITLE_COMPANY_DEDUPE = 3;

/**
 * Second pass: drop later rows that clearly match an earlier row from another source.
 * Strong signal: same canonical apply URL. Weaker (only if no URL on that row): long title + company match.
 * First row in merge order wins (Adzuna before Remote OK today).
 */
function dedupeCrossSource(jobs: NormalizedJob[]): NormalizedJob[] {
  const seenUrls = new Set<string>();
  const seenTitleCompany = new Set<string>();
  const out: NormalizedJob[] = [];

  for (const job of jobs) {
    const urlKey = crossSourceCanonicalApplyUrl(job.applyUrl);
    if (urlKey) {
      if (seenUrls.has(urlKey)) continue;
      seenUrls.add(urlKey);
      out.push(job);
      continue;
    }

    const company = job.company?.trim() ?? "";
    const titleNorm = normalizeLabel(job.title);
    if (
      company.length >= MIN_COMPANY_LEN_TITLE_COMPANY_DEDUPE &&
      titleNorm.length >= MIN_TITLE_LEN_TITLE_COMPANY_DEDUPE
    ) {
      const tcKey = `${titleNorm}\0${normalizeLabel(company)}`;
      if (seenTitleCompany.has(tcKey)) continue;
      seenTitleCompany.add(tcKey);
    }

    out.push(job);
  }

  return out;
}

export async function ingestJobs(): Promise<IngestJobsResult> {
  const merged: NormalizedJob[] = [];

  for (const fetchJobs of sources) {
    try {
      const batch = await fetchJobs();
      merged.push(...batch);
    } catch (e) {
      console.error("[ingestJobs] source failed:", e instanceof Error ? e.message : e);
    }
  }

  const rawMerged = merged.length;
  const perSource = dedupeBySourceAndExternalId(merged);
  const afterSameSource = perSource.length;
  const jobs = dedupeCrossSource(perSource);
  const afterCrossSource = jobs.length;

  return {
    jobs,
    dedupe: {
      rawMerged,
      afterSameSource,
      afterCrossSource,
      sameSourceDropped: rawMerged - afterSameSource,
      crossSourceDropped: afterSameSource - afterCrossSource,
    },
  };
}
