import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/page-header";
import type { ApplicationOutcomeStatus, DecisionAnalysis } from "@prisma/client";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Briefcase } from "lucide-react";
import { JobCreateForm } from "@/components/job-create-form";
import { JobsListWithFilters } from "@/components/jobs-list-with-filters";
import { JobsSummaryStrip } from "@/components/jobs-summary-strip";
import { buildJobsFeedSummaryRows, computeJobsListSummary } from "@/lib/jobs-list-summary";
import { resolveUserId } from "@/lib/services/user";
import { fetchJobsListBundle, type JobWithLatestForList } from "@/lib/services/jobs-list-bundle";
import { listApplyGuidanceFromDecisionOrMatch } from "@/lib/services/decision-service";
import { parseJobsFeedSort } from "@/lib/jobs-feed-rank";
import { whyLineFromBreakdown, whyLineFromScoreFallback } from "@/lib/jobs-feed-why-line";
import { cn } from "@/lib/utils/cn";
import type { NormalizedImpactMetrics } from "@/lib/types/impact-metrics";

type JobWithLatest = JobWithLatestForList;

function jobCardWhyLine(job: JobWithLatest, hasFeedResume: boolean): string {
  const latest = job.matchAnalyses[0];
  if (!latest) {
    return hasFeedResume
      ? "No match yet for this resume — open the job to score."
      : "Add a resume to score fit, then open this job.";
  }
  const fromBreakdown = whyLineFromBreakdown(latest.breakdown);
  if (fromBreakdown) return fromBreakdown;
  return whyLineFromScoreFallback(latest.matchScore, latest.verdict);
}

export const dynamic = "force-dynamic";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sort = parseJobsFeedSort(sp.sort);

  const userId = await resolveUserId();
  let jobs: JobWithLatest[] = [];
  let loadError = false;
  let statusByJob = new Map<string, ApplicationOutcomeStatus>();
  let feedContext = {
    resumeId: null as string | null,
    resumeTitle: null as string | null,
    usedPrimaryResume: false,
    hasAnyResume: false,
  };
  let latestDecisionByJob = new Map<string, DecisionAnalysis>();
  let impactMetricIdByJob = new Map<string, string | null>();
  let normalizedImpactByJob = new Map<string, NormalizedImpactMetrics | null>();

  try {
    const bundle = await fetchJobsListBundle(userId, { sort });
    jobs = bundle.jobs;
    statusByJob = bundle.statusByJob;
    feedContext = bundle.feedContext;
    latestDecisionByJob = bundle.latestDecisionByJob;
    impactMetricIdByJob = bundle.impactMetricIdByJob;
    normalizedImpactByJob = bundle.normalizedImpactByJob;
  } catch {
    loadError = true;
    jobs = [];
  }

  const hasFeedResume = Boolean(feedContext.resumeId);

  const jobRows = jobs.map((job) => {
    const latest = job.matchAnalyses[0];
    const persisted = latestDecisionByJob.get(job.id);
    const impactId = impactMetricIdByJob.get(job.id) ?? null;
    const impactNorm = normalizedImpactByJob.get(job.id) ?? null;
    const guidance = listApplyGuidanceFromDecisionOrMatch(
      latest
        ? {
            id: latest.id,
            matchScore: latest.matchScore,
            verdict: latest.verdict,
            breakdown: latest.breakdown,
          }
        : null,
      persisted,
      impactId,
      impactNorm,
    );
    let whyLine = jobCardWhyLine(job, hasFeedResume);
    if (guidance?.trust.inferredWithoutMatch && !latest) {
      whyLine = hasFeedResume
        ? "Impact data exists, but no match score yet — open the job to score for a full read."
        : "Add a resume first — scoring is needed for a full fit read.";
    }
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      source: job.source,
      whyLine,
      latest: latest
        ? { matchScore: latest.matchScore, verdict: latest.verdict }
        : null,
      decisionBadge: guidance ? { label: guidance.label, tone: guidance.tone } : null,
      decisionTrust: guidance?.trust ?? null,
      trackingStatus: statusByJob.get(job.id) ?? null,
    };
  });

  return (
    <AppShell title="Jobs">
      <PageHeader
        title="Jobs"
        description="Ranked opportunities for your resume — match, decision hint, and tracking in one place."
      >
        <Link
          href="/analytics"
          className={cn(
            "inline-flex h-10 items-center justify-center rounded-xl border border-border bg-transparent px-4 text-sm font-medium text-foreground transition-all duration-200 hover:border-border-hover hover:bg-muted/50",
          )}
        >
          View analytics
        </Link>
      </PageHeader>

      {!loadError && jobs.length > 0 ? (
        <div className="mb-6 rounded-2xl border border-border bg-card/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          {feedContext.hasAnyResume ? (
            <>
              {feedContext.usedPrimaryResume ? (
                <p>
                  Showing opportunities ranked for your primary resume
                  {feedContext.resumeTitle ? (
                    <>
                      : <span className="font-medium text-foreground">{feedContext.resumeTitle}</span>
                    </>
                  ) : null}
                  .
                </p>
              ) : (
                <p>
                  Showing opportunities ranked for your resume
                  {feedContext.resumeTitle ? (
                    <>
                      : <span className="font-medium text-foreground">{feedContext.resumeTitle}</span>
                    </>
                  ) : null}
                  . No primary resume is set — using your most recently updated resume.
                </p>
              )}
              <p className="pt-1 text-xs">
                <Link href="/resumes" className="font-medium text-primary underline-offset-4 hover:underline">
                  Change primary resume
                </Link>
              </p>
              <p className="pt-2 text-xs leading-relaxed text-muted-foreground/90">
                Apply / Consider / Skip matches your saved decision when it is still current for this resume and job;
                otherwise it follows match scoring until you save a new decision.
              </p>
            </>
          ) : (
            <p>
              Add a resume to rank jobs for fit and show decision hints.{" "}
              <Link href="/resumes" className="font-medium text-primary underline-offset-4 hover:underline">
                Resume library
              </Link>
            </p>
          )}
        </div>
      ) : null}

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
          <JobsSummaryStrip
            summary={computeJobsListSummary(
              buildJobsFeedSummaryRows(
                jobs,
                statusByJob,
                latestDecisionByJob,
                impactMetricIdByJob,
                normalizedImpactByJob,
              ),
            )}
          />
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground" role="status">
                Loading job list…
              </p>
            }
          >
            <JobsListWithFilters
              rows={jobRows}
              feedResumeId={feedContext.resumeId}
              feedResumeTitle={feedContext.resumeTitle}
            />
          </Suspense>
        </>
      )}
    </AppShell>
  );
}
