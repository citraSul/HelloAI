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
import { quickApplyGuidanceFromMatch } from "@/lib/services/decision-service";
import { OutcomeStatusBadge } from "@/components/outcome-status-badge";
import type { ApplicationOutcomeStatus } from "@prisma/client";
import { effectiveTrackingSaved, PIPELINE_TRACKING_STATUSES } from "@/lib/jobs-tracking-buckets";

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
  applyUrl: string | null;
  signalLine: string;
  latest: { matchScore: number; verdict: string } | null;
  /** Outcome for default tracking resume (primary or newest); null if none stored yet. */
  trackingStatus: ApplicationOutcomeStatus | null;
};

function normalizeFilter(v: string | null, allowed: string[], fallback: string) {
  const s = (v ?? "").trim().toLowerCase();
  return allowed.includes(s) ? s : fallback;
}

export function JobsListWithFilters({ rows }: { rows: JobsListRowVM[] }) {
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
        if (!row.latest) return false;
        const { label } = quickApplyGuidanceFromMatch(row.latest.matchScore, row.latest.verdict);
        if (label.toLowerCase() !== decisionFilter) return false;
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
    trackingFilter !== "all";

  return (
    <div className={cn(pending && "opacity-90 transition-opacity")}>
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-card/50 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
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
            title="By your primary (or default) resume on each job"
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
            onClick={() =>
              pushParams({ q: null, score: null, decision: null, track: null })
            }
          >
            Clear filters
          </Button>
        ) : null}
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
          <ul className="space-y-3">
            {filtered.map((job) => {
              const latest = job.latest;
              return (
                <li key={job.id}>
                  <Card className="transition-all duration-200 hover:border-border-hover hover:shadow-card">
                    <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                      <Link
                        href={`/jobs/${job.id}`}
                        className={cn(
                          "min-w-0 flex-1 cursor-pointer space-y-2.5 rounded-lg outline-none sm:pr-2",
                          jobRowFocus,
                        )}
                      >
                        <p className="text-base font-semibold leading-snug text-foreground">{job.title}</p>
                        {latest || job.source || (job.trackingStatus && job.trackingStatus !== "saved") ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {latest ? (
                              <DecisionListBadge matchScore={latest.matchScore} verdict={latest.verdict} />
                            ) : null}
                            {job.trackingStatus && job.trackingStatus !== "saved" ? (
                              <OutcomeStatusBadge status={job.trackingStatus} />
                            ) : null}
                            {job.source ? (
                              <span
                                className="shrink-0 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-label"
                                title="Imported from job feed"
                              >
                                {job.source}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        <p className="text-sm text-muted-foreground">{job.company ?? "Company TBD"}</p>
                        <p
                          className="line-clamp-2 border-l-2 border-border/70 pl-3 text-xs leading-snug text-muted-foreground/90"
                          title={job.signalLine}
                        >
                          {job.signalLine}
                        </p>
                      </Link>
                      <div className="flex shrink-0 flex-col items-end gap-2 sm:pt-0.5">
                        {job.applyUrl ? (
                          <a
                            href={job.applyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                          >
                            Open original listing
                          </a>
                        ) : null}
                        {latest ? (
                          <Link
                            href={`/jobs/${job.id}`}
                            className={cn(
                              "inline-flex cursor-pointer rounded-full outline-none",
                              jobRowFocus,
                            )}
                          >
                            <ScoreBadge score={latest.matchScore} verdict={latest.verdict} />
                          </Link>
                        ) : (
                          <Link
                            href={`/jobs/${job.id}`}
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
            })}
          </ul>
        </>
      )}
    </div>
  );
}
