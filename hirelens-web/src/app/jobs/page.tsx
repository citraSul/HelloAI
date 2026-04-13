import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/page-header";
import type { ApplicationOutcomeStatus } from "@prisma/client";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Briefcase } from "lucide-react";
import { JobCreateForm } from "@/components/job-create-form";
import { JobsListWithFilters } from "@/components/jobs-list-with-filters";
import { JobsSummaryStrip } from "@/components/jobs-summary-strip";
import { computeJobsListSummary, jobsFromBundleToSummaryRows } from "@/lib/jobs-list-summary";
import { resolveUserId } from "@/lib/services/user";
import { fetchJobsListBundle, type JobWithLatestForList } from "@/lib/services/jobs-list-bundle";
import { cn } from "@/lib/utils/cn";

type JobWithLatest = JobWithLatestForList;

const BREAKDOWN_META_KEYS = new Set(["strengths", "gaps", "reasoning", "missing_keywords"]);

function formatDimLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function topDimensionSnippet(breakdown: unknown): string | null {
  if (!breakdown || typeof breakdown !== "object") return null;
  const b = breakdown as Record<string, unknown>;
  let best: { key: string; value: number } | null = null;
  for (const [k, v] of Object.entries(b)) {
    if (BREAKDOWN_META_KEYS.has(k) || typeof v !== "number" || !Number.isFinite(v)) continue;
    if (!best || v > best.value) best = { key: k, value: v };
  }
  if (!best) return null;
  return `Best fit: ${formatDimLabel(best.key)} (${Math.round(best.value * 100)}%)`;
}

/** One line from stored match breakdown; prefers narrative, then keyword gaps, then dimension scores. */
function matchBreakdownSubtitle(breakdown: unknown): string | null {
  if (!breakdown || typeof breakdown !== "object") return null;
  const b = breakdown as Record<string, unknown>;

  if (typeof b.reasoning === "string" && b.reasoning.trim()) {
    const t = b.reasoning.trim().replace(/\s+/g, " ");
    return t.length > 130 ? `${t.slice(0, 127)}…` : t;
  }

  if (Array.isArray(b.strengths)) {
    const first = b.strengths.find((x) => typeof x === "string" && x.trim());
    if (typeof first === "string") {
      const t = first.trim();
      return t.length > 110 ? `Strength: ${t.slice(0, 107)}…` : `Strength: ${t}`;
    }
  }

  if (Array.isArray(b.gaps)) {
    const first = b.gaps.find((x) => typeof x === "string" && x.trim());
    if (typeof first === "string") {
      const t = first.trim();
      return t.length > 110 ? `Gap: ${t.slice(0, 107)}…` : `Gap: ${t}`;
    }
  }

  if (Array.isArray(b.missing_keywords) && b.missing_keywords.length > 0) {
    const n = b.missing_keywords.length;
    return n === 1 ? "1 posting keyword missing vs resume" : `${n} posting keywords missing vs resume`;
  }

  return topDimensionSnippet(breakdown);
}

function jobCardSignalLine(job: JobWithLatest): string {
  const latest = job.matchAnalyses[0];
  if (!latest) {
    return "No match yet — open to score against a resume";
  }

  const resumeTitle = latest.resume?.title?.trim();
  const fromBreakdown = matchBreakdownSubtitle(latest.breakdown);
  const pct = Math.round(latest.matchScore * 100);

  if (fromBreakdown) {
    return resumeTitle ? `${fromBreakdown} · ${resumeTitle}` : fromBreakdown;
  }

  if (resumeTitle) {
    return `${pct}% match (${latest.verdict}) · last run with ${resumeTitle}`;
  }
  return `${pct}% match (${latest.verdict}) — open for full breakdown`;
}

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const userId = await resolveUserId();
  let jobs: JobWithLatest[] = [];
  let loadError = false;
  let statusByJob = new Map<string, ApplicationOutcomeStatus>();
  try {
    const bundle = await fetchJobsListBundle(userId);
    jobs = bundle.jobs;
    statusByJob = bundle.statusByJob;
  } catch {
    loadError = true;
    jobs = [];
  }

  const jobRows = jobs.map((job) => {
    const latest = job.matchAnalyses[0];
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      source: job.source,
      applyUrl: job.applyUrl,
      signalLine: jobCardSignalLine(job),
      latest: latest
        ? { matchScore: latest.matchScore, verdict: latest.verdict }
        : null,
      trackingStatus: statusByJob.get(job.id) ?? null,
    };
  });

  return (
    <AppShell title="Jobs">
      <PageHeader title="Jobs" description="Roles you track and the latest match signal for each.">
        <Link
          href="/analytics"
          className={cn(
            "inline-flex h-10 items-center justify-center rounded-xl border border-border bg-transparent px-4 text-sm font-medium text-foreground transition-all duration-200 hover:border-border-hover hover:bg-muted/50",
          )}
        >
          View analytics
        </Link>
      </PageHeader>
      <div className="mb-10">
        <JobCreateForm />
      </div>
      {loadError ? (
        <EmptyState
          icon={Briefcase}
          title="Could not load jobs"
          description="Check DATABASE_URL and run prisma db push. See dashboard for setup hints."
        />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs yet"
          description="Use the form above or POST to /api/jobs/analyze with title, company, and rawDescription. To pull jobs from configured feeds, POST to /api/jobs/ingest with X-Cron-Secret or Authorization: Bearer set to your CRON_SECRET."
        />
      ) : (
        <>
          <JobsSummaryStrip summary={computeJobsListSummary(jobsFromBundleToSummaryRows(jobs, statusByJob))} />
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground" role="status">
                Loading job list…
              </p>
            }
          >
            <JobsListWithFilters rows={jobRows} />
          </Suspense>
        </>
      )}
    </AppShell>
  );
}
