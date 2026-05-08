"use client";

import { useCallback, useMemo, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/score-badge";
import { DecisionListBadge } from "@/components/decision-list-badge";
import { EmptyState } from "@/components/empty-state";
import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { DecisionListTone } from "@/components/decision-list-badge";
import type { DecisionConfidence } from "@/lib/types/decision";
import { OutcomeStatusBadge } from "@/components/outcome-status-badge";
import type { ApplicationOutcomeStatus } from "@prisma/client";
import { effectiveTrackingSaved, PIPELINE_TRACKING_STATUSES } from "@/lib/jobs-tracking-buckets";
import { JOBS_FEED_SORTS, type JobsFeedSort } from "@/lib/jobs-feed-rank";

const jobRowFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25";

function rowMatchesTrackingFilter(
  row: JobsListRowVM,
  trackingFilter: string,
): boolean {
  if (trackingFilter === "all") return true;
  const s = row.trackingStatus;
  if (trackingFilter === "saved") return effectiveTrackingSaved(s);
  if (trackingFilter === "applied") return s === "applied";
  if (trackingFilter === "skipped") return s === "skipped";
  if (trackingFilter === "progressed") {
    return s != null && PIPELINE_TRACKING_STATUSES.includes(s);
  }
  return true;
}

export type JobsListRowVM = {
  id: string;
  title: string;
  company: string | null;
  source: string | null;
  /** Short “why” from the same match breakdown as score + badge. */
  whyLine: string;
  latest: { matchScore: number; verdict: string } | null;
  /** Apply / Consider / Skip when evidence supports a tier; null = insufficient data for a defensible chip. */
  decisionBadge: {
    label: "Apply" | "Consider" | "Skip";
    tone: DecisionListTone;
  } | null;
  /** Present only when `decisionBadge` is set; not rendered. */
  decisionTrust: {
    confidence: DecisionConfidence;
    inferredWithoutMatch: boolean;
  } | null;
  /** Outcome for feed resume (primary or default). */
  trackingStatus: ApplicationOutcomeStatus | null;
  /** Continuity handoff from Tailor/Impact to this list row. */
  continuityText: string | null;
  /** Subtle emphasis that this row has recent Tailor/Impact activity. */
  recentlyUpdated: boolean;
  recentlyUpdatedLabel: string | null;
};

function normalizeFilter(v: string | null, allowed: string[], fallback: string) {
  const s = (v ?? "").trim().toLowerCase();
  return allowed.includes(s) ? s : fallback;
}

function sortFromParams(raw: string | null): JobsFeedSort {
  const s = (raw ?? "").trim().toLowerCase();
  return JOBS_FEED_SORTS.includes(s as JobsFeedSort) ? (s as JobsFeedSort) : "fit";
}

export function JobsListWithFilters({
  rows,
  feedResumeId,
  feedResumeTitle,
}: {
  rows: JobsListRowVM[];
  feedResumeId: string | null;
  feedResumeTitle: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const qRaw = searchParams.get("q") ?? "";
  const q = qRaw.trim().toLowerCase();
  const scoreFilter = normalizeFilter(searchParams.get("score"), ["all", "scored", "unscored"], "all");
  const decisionFilter = normalizeFilter(
    searchParams.get("decision"),
    ["all", "apply", "consider", "skip"],
    "all",
  );
  const trackingFilter = normalizeFilter(
    searchParams.get("track"),
    ["all", "saved", "applied", "skipped", "progressed"],
    "all",
  );
  const sortParam = sortFromParams(searchParams.get("sort"));

  const pushParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      startTransition(() => {
        const next = new URLSearchParams(searchParams.toString());
        for (const [k, v] of Object.entries(updates)) {
          if (v === undefined || v === null || v === "" || v === "all") {
            next.delete(k);
          } else {
            next.set(k, v);
          }
        }
        const s = next.toString();
        router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (scoreFilter === "scored" && !row.latest) return false;
      if (scoreFilter === "unscored" && row.latest) return false;

      if (decisionFilter !== "all") {
        if (!row.decisionBadge) return false;
        if (row.decisionBadge.label.toLowerCase() !== decisionFilter) return false;
      }

      if (!rowMatchesTrackingFilter(row, trackingFilter)) return false;

      if (!q) return true;
      const hay = `${row.title} ${row.company ?? ""} ${row.source ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, q, scoreFilter, decisionFilter, trackingFilter]);

  const hasActiveFilters =
    qRaw.trim().length > 0 ||
    scoreFilter !== "all" ||
    decisionFilter !== "all" ||
    trackingFilter !== "all" ||
    sortParam !== "fit";

  const detailHref = (jobId: string) =>
    feedResumeId
      ? `/jobs/${jobId}?resumeId=${encodeURIComponent(feedResumeId)}`
      : `/jobs/${jobId}`;

  const tailorHref = (jobId: string) => {
    const p = new URLSearchParams();
    if (feedResumeId) p.set("resumeId", feedResumeId);
    p.set("jobId", jobId);
    return `/tailor?${p.toString()}`;
  };

  const ctaClass =
    "inline-flex h-9 items-center justify-center rounded-lg border border-border bg-transparent px-3 text-xs font-medium text-foreground transition-colors hover:border-border-hover hover:bg-muted/40";
  const listOrderExplainer =
    sortParam === "fit"
      ? "Recommended order — ranked by Apply / Consider / Skip, then fit strength and recency."
      : sortParam === "score"
        ? "Score order — sorted by raw match %, so badges may not match the list order."
        : "Recency order — sorted by HireLens update time, not employer post date.";
  const fitSections =
    sortParam === "fit"
      ? [
          {
            key: "apply",
            title: "Recommended (Apply)",
            jobs: filtered.filter((job) => job.decisionBadge?.label === "Apply"),
          },
          {
            key: "consider",
            title: "Consider",
            jobs: filtered.filter((job) => job.decisionBadge?.label === "Consider"),
          },
          {
            key: "skip",
            title: "Low priority",
            jobs: filtered.filter((job) => job.decisionBadge?.label === "Skip"),
          },
          {
            key: "other",
            title: "Other opportunities — not enough data yet",
            jobs: filtered.filter((job) => !job.decisionBadge),
          },
        ]
      : [];
  const renderJobListItem = (job: JobsListRowVM) => {
    const latest = job.latest;
    const hasSupportingContext = Boolean(job.whyLine || job.continuityText || feedResumeTitle);
    return (
      <li key={job.id}>
        <Card
          className={cn(
            "border-border/50 bg-card/95 transition-all duration-300 hover:border-border-hover/85 hover:shadow-card-lift",
            job.recentlyUpdated && "border-primary/35 ring-1 ring-primary/15",
          )}
        >
          <CardContent className="flex flex-col gap-3.5 py-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:py-7">
            <div className="min-w-0 flex-1 space-y-0 sm:pr-2">
              <h3 className="text-lg font-semibold leading-snug tracking-[-0.02em] text-foreground md:text-xl">
                {job.title}
              </h3>
              <p className="mt-1.5 text-sm leading-snug text-muted-foreground">{job.company ?? "Company TBD"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                {job.decisionBadge ? (
                  <DecisionListBadge
                    label={job.decisionBadge.label}
                    tone={job.decisionBadge.tone}
                    trust={job.decisionTrust}
                  />
                ) : null}
                {job.recentlyUpdatedLabel ? (
                  <span className="shrink-0 rounded-md border border-primary/30 bg-primary/[0.1] px-2 py-0.5 text-[10px] font-medium tracking-wide text-primary">
                    Recently updated · {job.recentlyUpdatedLabel}
                  </span>
                ) : null}
              </div>
              {job.source || (job.trackingStatus && job.trackingStatus !== "saved") ? (
                <div className="mt-2 flex flex-wrap items-start gap-2">
                  {job.trackingStatus && job.trackingStatus !== "saved" ? (
                    <OutcomeStatusBadge status={job.trackingStatus} />
                  ) : null}
                  {job.source ? (
                    <span
                      className="shrink-0 rounded-md border border-border/60 bg-muted/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                      title="Imported from job feed"
                    >
                      {job.source}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {hasSupportingContext ? (
                <details className="mt-2.5 rounded-lg border border-border/50 bg-muted/[0.05] px-3 py-2">
                  <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                    Why this row
                  </summary>
                  <div className="pt-2">
                    <p
                      className="line-clamp-2 border-l-2 border-primary/20 pl-3 text-[11px] leading-relaxed text-muted-foreground"
                      title={job.whyLine}
                    >
                      {job.whyLine}
                    </p>
                    {job.continuityText ? (
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/90">
                        <span className="font-medium text-foreground/85">Sync: </span>
                        {job.continuityText}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[10px] leading-snug text-muted-foreground/80">
                      Based on{" "}
                      <span className="font-medium text-foreground/90">
                        {feedResumeTitle ?? "— add a resume in Resume library"}
                      </span>
                    </p>
                  </div>
                </details>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-3">
                <Link
                  href={detailHref(job.id)}
                  className={cn(ctaClass, jobRowFocus)}
                >
                  View details
                </Link>
                {feedResumeId ? (
                  <Link href={tailorHref(job.id)} className={cn(ctaClass, jobRowFocus)}>
                    Tailor now
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2 sm:pt-1">
              {latest ? (
                <Link
                  href={detailHref(job.id)}
                  className={cn(
                    "inline-flex cursor-pointer rounded-full outline-none",
                    jobRowFocus,
                  )}
                >
                  <ScoreBadge score={latest.matchScore} verdict={latest.verdict} />
                </Link>
              ) : (
                <Link
                  href={detailHref(job.id)}
                  className={cn(
                    "inline-flex cursor-pointer rounded-full outline-none",
                    jobRowFocus,
                  )}
                >
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-label">
                    No score yet
                  </span>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </li>
    );
  };

  return (
    <div className={cn(pending && "opacity-90 transition-opacity")}>
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border/60 bg-muted/[0.08] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
        <div className="min-w-0 flex-1 sm:min-w-[200px]">
          <label
            htmlFor="jobs-search"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-label"
          >
            Search
          </label>
          <input
            id="jobs-search"
            type="search"
            enterKeyHint="search"
            placeholder="Title, company, or source…"
            value={qRaw}
            onChange={(e) => pushParams({ q: e.target.value || null })}
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-3 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/25"
          />
        </div>
        <div className="w-full sm:w-48">
          <label
            htmlFor="jobs-sort"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-label"
          >
            List order
          </label>
          <select
            id="jobs-sort"
            value={sortParam}
            aria-describedby="jobs-sort-hint"
            title="Best fit uses Apply / Consider / Skip tiers (same as badges), then match %, then recency. Score uses only saved match %. Newest uses when the job was last updated here."
            onChange={(e) => {
              const v = e.target.value as JobsFeedSort;
              pushParams({ sort: v === "fit" ? null : v });
            }}
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-3 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/25"
          >
            <option value="fit">Best fit — badges (Apply · Consider · Skip)</option>
            <option value="score">Match score — highest % first</option>
            <option value="newest">Newest — job updated last</option>
          </select>
          <p id="jobs-sort-hint" className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
            {sortParam === "fit" ? (
              <>
                <span className="font-medium text-foreground/90">Recommended.</span> Same priority as each row’s
                Apply / Consider / Skip, then match strength, then recency.
              </>
            ) : sortParam === "score" ? (
              <>
                Raw saved match % only. Row order can disagree with Apply / Consider / Skip — use Best fit for that.
              </>
            ) : (
              <>By when this job was last updated in HireLens — not by fit or badge.</>
            )}
          </p>
        </div>
        <div className="w-full sm:w-44">
          <label
            htmlFor="jobs-score-filter"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-label"
          >
            Match status
          </label>
          <select
            id="jobs-score-filter"
            value={scoreFilter}
            onChange={(e) => pushParams({ score: e.target.value })}
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-3 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/25"
          >
            <option value="all">All jobs</option>
            <option value="scored">Scored</option>
            <option value="unscored">Not scored yet</option>
          </select>
        </div>
        <div className="w-full sm:w-44">
          <label
            htmlFor="jobs-decision-filter"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-label"
          >
            Decision
          </label>
          <select
            id="jobs-decision-filter"
            value={decisionFilter}
            onChange={(e) => pushParams({ decision: e.target.value })}
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-3 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/25"
          >
            <option value="all">All</option>
            <option value="apply">Apply</option>
            <option value="consider">Consider</option>
            <option value="skip">Skip</option>
          </select>
        </div>
        <div className="w-full sm:w-44">
          <label
            htmlFor="jobs-tracking-filter"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-label"
          >
            Tracked status
          </label>
          <select
            id="jobs-tracking-filter"
            value={trackingFilter}
            onChange={(e) => pushParams({ track: e.target.value })}
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-3 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/25"
            title="Uses the same resume as the feed (primary or default)"
          >
            <option value="all">All</option>
            <option value="saved">Saved / watching</option>
            <option value="applied">Applied</option>
            <option value="skipped">Skipped</option>
            <option value="progressed">In pipeline</option>
          </select>
        </div>
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => pushParams({ q: null, score: null, decision: null, track: null, sort: null })}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
      <div className="mb-4 space-y-2 rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <p>{listOrderExplainer}</p>
        <p className="text-[11px] leading-snug text-muted-foreground/95">
          Rows and filters use the feed resume named at the bottom of each card (primary when set, otherwise your most
          recently updated resume). Same resume as the Jobs page banner when it appears.
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No matching jobs"
          description={
            hasActiveFilters
              ? "Nothing matches your search or filters. Try different keywords, tracked status, or reset filters."
              : "No jobs to show."
          }
        />
      ) : (
        <>
          {hasActiveFilters ? (
            <p className="mb-3 text-xs text-muted-foreground" aria-live="polite">
              Showing {filtered.length} of {rows.length} jobs
            </p>
          ) : null}
          {sortParam === "fit" ? (
            <div className="space-y-8">
              {fitSections
                .filter((section) => section.jobs.length > 0)
                .map((section) => (
                  <section key={section.key} aria-label={section.title}>
                    <div className="mb-3 border-b border-border/70 pb-2.5">
                      <p className="text-[13px] font-semibold leading-tight tracking-tight text-foreground">
                        {section.title}
                      </p>
                    </div>
                    <ul className="space-y-3.5">
                      {section.jobs.map((job) => renderJobListItem(job))}
                    </ul>
                  </section>
                ))}
            </div>
          ) : (
            <ul className="space-y-3.5">
              {filtered.map((job) => renderJobListItem(job))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
