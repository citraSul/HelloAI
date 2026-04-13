/**
 * Remote OK public jobs API (read-only). No API key. Aligns loosely with `job_feed.py` in repo root.
 * @see https://remoteok.com/api
 */

import type { NormalizedJob } from "@/lib/jobs/types";

const REMOTEOK_API = "https://remoteok.com/api";
const MAX_JOBS = 10;
const MIN_DESC_LEN = 40;

/** Same CS/dev heuristic family as `job_feed.py` (subset). */
const CS_TERMS = [
  "developer",
  "engineer",
  "programming",
  "software",
  "backend",
  "frontend",
  "fullstack",
  "full stack",
  "devops",
  "sre",
  "data scientist",
  "machine learning",
  "data engineer",
  "python",
  "javascript",
  "typescript",
  "react",
  "node",
  "golang",
  "rust",
  "kubernetes",
  "web developer",
  "security engineer",
  "qa automation",
  "test automation",
] as const;

export type RemoteOkRow = {
  id?: string | number;
  slug?: string;
  position?: string;
  company?: string;
  description?: string;
  url?: string;
  tags?: unknown[];
};

function stripHtml(html: string): string {
  const text = html.replace(/<[^>]+>/g, " ");
  return decodeBasicEntities(text).replace(/\s+/g, " ").trim();
}

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function isCsRelated(title: string, tags: string[], description: string): boolean {
  const blob = `${title} ${tags.join(" ")} ${description.slice(0, 8000)}`.toLowerCase();
  return CS_TERMS.some((t) => blob.includes(t));
}

function buildApplyUrl(row: RemoteOkRow): string | undefined {
  const direct = typeof row.url === "string" ? row.url.trim() : "";
  if (direct) return direct;
  const slug = typeof row.slug === "string" ? row.slug.trim() : "";
  const jid = row.id != null ? String(row.id).trim() : "";
  if (slug) return `https://remoteok.com/remote-jobs/${slug}`;
  if (jid) return `https://remoteok.com/remote-jobs?id=${jid}`;
  return undefined;
}

/** Exported for unit tests; production path uses {@link fetchRemoteOkJobs}. */
export function mapRemoteOkRow(row: RemoteOkRow): NormalizedJob | null {
  const jid = row.id != null ? String(row.id).trim() : "";
  const slug = typeof row.slug === "string" ? row.slug.trim() : "";
  const externalId = jid || slug;
  if (!externalId) return null;

  const title = (row.position ?? "").trim() || "Role";
  const companyRaw = (row.company ?? "").trim();
  const company = companyRaw || undefined;

  const descHtml = typeof row.description === "string" ? row.description : "";
  const description = stripHtml(descHtml);
  if (description.length < MIN_DESC_LEN) return null;

  const tags = Array.isArray(row.tags)
    ? row.tags.map((t) => (t != null ? String(t) : "")).filter(Boolean)
    : [];

  if (!isCsRelated(title, tags, description)) return null;

  const applyUrl = buildApplyUrl(row);
  if (!applyUrl) return null;

  return {
    title: title.slice(0, 500),
    ...(company ? { company: company.slice(0, 300) } : {}),
    description: description.slice(0, 120_000),
    source: "remoteok",
    externalId,
    applyUrl,
  };
}

/**
 * Fetches up to 10 CS-related remote jobs from Remote OK (public API).
 */
export async function fetchRemoteOkJobs(): Promise<NormalizedJob[]> {
  let res: Response;
  try {
    res = await fetch(REMOTEOK_API, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "HireLens/1.0 (job feed; +https://github.com/citraSul/HelloAI)",
      },
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Remote OK: request failed (${msg})`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const snippet = body.replace(/\s+/g, " ").trim().slice(0, 400);
    throw new Error(
      `Remote OK: API error ${res.status} ${res.statusText}${snippet ? ` — ${snippet}` : ""}`,
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error("Remote OK: response body is not valid JSON");
  }

  if (!Array.isArray(data) || data.length < 2) {
    return [];
  }

  const out: NormalizedJob[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || typeof row !== "object") continue;
    const mapped = mapRemoteOkRow(row as RemoteOkRow);
    if (mapped) out.push(mapped);
    if (out.length >= MAX_JOBS) break;
  }

  return out;
}
