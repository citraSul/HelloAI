/**
 * Adzuna Jobs API (read-only). Does not touch the database.
 * @see https://developer.adzuna.com/docs/search
 */

import type { NormalizedJob } from "@/lib/jobs/types";

type AdzunaCompany = {
  display_name?: string;
};

type AdzunaJobResult = {
  id?: string | number;
  title?: string;
  company?: AdzunaCompany;
  description?: string;
  redirect_url?: string;
};

type AdzunaSearchResponse = {
  results?: AdzunaJobResult[];
};

function getEnv(name: "ADZUNA_APP_ID" | "ADZUNA_APP_KEY"): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(`Adzuna: missing required environment variable ${name}`);
  }
  return v;
}

function companyDisplayName(company: AdzunaJobResult["company"]): string | undefined {
  if (!company || typeof company !== "object") return undefined;
  const name = company.display_name?.trim();
  return name || undefined;
}

function mapResult(job: AdzunaJobResult): NormalizedJob | null {
  const id = job.id;
  if (id === undefined || id === null) return null;
  const externalId = String(id).trim();
  if (!externalId) return null;

  const title = (job.title ?? "").trim();
  if (!title) return null;

  const description = typeof job.description === "string" ? job.description : "";
  const company = companyDisplayName(job.company);
  const redirect =
    typeof job.redirect_url === "string" && job.redirect_url.trim()
      ? job.redirect_url.trim()
      : undefined;

  return {
    title,
    ...(company ? { company } : {}),
    description,
    source: "adzuna",
    externalId,
    ...(redirect ? { applyUrl: redirect } : {}),
  };
}

/**
 * Fetches up to 10 US jobs from Adzuna for "backend engineer" in "remote".
 * Uses `what` / `where` (Adzuna query params) matching the requested query/location semantics.
 */
export async function fetchAdzunaJobs(): Promise<NormalizedJob[]> {
  const appId = getEnv("ADZUNA_APP_ID");
  const appKey = getEnv("ADZUNA_APP_KEY");

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "10",
    what: "backend engineer",
    where: "remote",
  });

  const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Adzuna: request failed (${msg})`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const snippet = body.replace(/\s+/g, " ").trim().slice(0, 400);
    throw new Error(
      `Adzuna: API error ${res.status} ${res.statusText}${snippet ? ` — ${snippet}` : ""}`,
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error("Adzuna: response body is not valid JSON");
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  const results = (data as AdzunaSearchResponse).results;
  if (!Array.isArray(results) || results.length === 0) {
    return [];
  }

  const out: NormalizedJob[] = [];
  for (const row of results) {
    if (!row || typeof row !== "object") continue;
    const mapped = mapResult(row as AdzunaJobResult);
    if (mapped) out.push(mapped);
  }

  return out;
}
