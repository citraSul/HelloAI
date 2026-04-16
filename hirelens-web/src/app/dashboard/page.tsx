import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { getDashboardOverview } from "@/lib/services/dashboard-service";
import { normalizeImpactMetrics } from "@/lib/services/normalize-impact-metrics";
import { prisma } from "@/lib/db/prisma";
import { resolveUserId } from "@/lib/services/user";
import { getDashboardOutcomeSnapshot } from "@/lib/services/application-outcome-service";
import { fetchJobsListBundle } from "@/lib/services/jobs-list-bundle";
import {
  buildJobsFeedSummaryRows,
  computeJobsListSummary,
  type JobsListSummary,
} from "@/lib/jobs-list-summary";
import { JobsSummaryStrip } from "@/components/jobs-summary-strip";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

type SampleReason = "sparse" | "db_partial" | null;

function fillDashboardSample(now: number) {
  return {
    overviewPatch: {
      activeJobs: 14,
      resumesIndexed: 3,
      avgMatchScore: 0.71,
      lastRunAt: new Date(now - 1000 * 60 * 18).toISOString(),
      recentActivity: [
        { id: "sample-1", label: "decision_engine · completed", at: new Date(now - 1000 * 60 * 18).toISOString() },
        { id: "sample-2", label: "impact_eval_agent · completed", at: new Date(now - 1000 * 60 * 53).toISOString() },
        { id: "sample-3", label: "resume_tailor_agent · completed", at: new Date(now - 1000 * 60 * 87).toISOString() },
        { id: "sample-4", label: "match_score_agent · completed", at: new Date(now - 1000 * 60 * 125).toISOString() },
      ],
    },
    highMatchJobs: 6,
    avgImpactScore: 74,
    recentMatches: [
      { id: "sm-1", title: "Senior Product Engineer", company: "Linear", matchScore: 0.84, verdict: "strong" },
      { id: "sm-2", title: "Full-Stack Engineer", company: "Notion", matchScore: 0.78, verdict: "strong" },
      { id: "sm-3", title: "Platform Engineer", company: "Figma", matchScore: 0.69, verdict: "moderate" },
      { id: "sm-4", title: "Product Engineer", company: "Stripe", matchScore: 0.74, verdict: "moderate" },
    ],
    recentTailored: [
      { id: "st-1", title: "Senior Product Engineer", company: "Linear", updatedAt: new Date(now - 1000 * 60 * 22) },
      { id: "st-2", title: "Full-Stack Engineer", company: "Notion", updatedAt: new Date(now - 1000 * 60 * 71) },
      { id: "st-3", title: "Platform Engineer", company: "Figma", updatedAt: new Date(now - 1000 * 60 * 132) },
    ],
  };
}

export default async function DashboardPage() {
  let overview: Awaited<ReturnType<typeof getDashboardOverview>> | null = null;
  let userId: string | null = null;
  let recentMatches: Array<{ id: string; title: string; company: string | null; matchScore: number; verdict: string }> = [];
  let recentTailored: Array<{ id: string; title: string; company: string | null; updatedAt: Date }> = [];
  let avgImpactScore = 0;
  let highMatchJobs = 0;
  let usingSample = false;
  let sampleReason: SampleReason = null;
  let outcomeSnapshot: Awaited<ReturnType<typeof getDashboardOutcomeSnapshot>> | null = null;

  try {
    overview = await getDashboardOverview();
  } catch {
    overview = null;
  }

  if (overview) {
    try {
      userId = await resolveUserId();
      const [matches, tailored, impacts] = await Promise.all([
        prisma.matchAnalysis.findMany({
          where: { userId },
          include: { job: { select: { title: true, company: true } } },
          orderBy: { createdAt: "desc" },
          take: 12,
        }),
        prisma.tailoredResume.findMany({
          where: { userId },
          include: { job: { select: { title: true, company: true } } },
          orderBy: { updatedAt: "desc" },
          take: 5,
        }),
        prisma.impactMetric.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 12,
        }),
      ]);
      recentMatches = matches.slice(0, 5).map((m) => ({
        id: m.id,
        title: m.job.title,
        company: m.job.company,
        matchScore: m.matchScore,
        verdict: m.verdict,
      }));
      recentTailored = tailored.map((t) => ({
        id: t.id,
        title: t.job.title,
        company: t.job.company,
        updatedAt: t.updatedAt,
      }));
      highMatchJobs = matches.filter((m) => m.matchScore >= 0.72).length;
      const impactRows = impacts
        .map((i) => normalizeImpactMetrics(i.metrics).impact_score)
        .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
      avgImpactScore =
        impactRows.length > 0 ? impactRows.reduce((sum, n) => sum + n, 0) / impactRows.length : 0;
    } catch {
      usingSample = true;
      sampleReason = "db_partial";
      const now = Date.now();
      const s = fillDashboardSample(now);
      overview = { ...overview, ...s.overviewPatch };
      highMatchJobs = s.highMatchJobs;
      avgImpactScore = s.avgImpactScore;
      recentMatches = s.recentMatches;
      recentTailored = s.recentTailored;
    }

    if (!sampleReason) {
      const nearEmpty =
        overview.activeJobs < 2 &&
        overview.resumesIndexed < 1 &&
        overview.recentActivity.length < 2 &&
        recentMatches.length < 2 &&
        recentTailored.length < 2;
      if (nearEmpty) {
        usingSample = true;
        sampleReason = "sparse";
        const now = Date.now();
        const s = fillDashboardSample(now);
        overview = { ...overview, ...s.overviewPatch };
        highMatchJobs = s.highMatchJobs;
        avgImpactScore = s.avgImpactScore;
        recentMatches = s.recentMatches;
        recentTailored = s.recentTailored;
      }
    }

    /** Real outcome data: load whenever we have a user id, independent of sample-mode metrics. */
    if (userId) {
      try {
        outcomeSnapshot = await getDashboardOutcomeSnapshot(userId);
      } catch {
        outcomeSnapshot = null;
      }
    }
  }

  let jobsWorkflowSummary: JobsListSummary | null = null;
  if (overview && userId && !usingSample) {
    try {
      const { jobs, statusByJob, latestDecisionByJob, impactMetricIdByJob, normalizedImpactByJob } =
        await fetchJobsListBundle(userId);
      jobsWorkflowSummary = computeJobsListSummary(
        buildJobsFeedSummaryRows(
          jobs,
          statusByJob,
          latestDecisionByJob,
          impactMetricIdByJob,
          normalizedImpactByJob,
        ),
      );
    } catch {
      jobsWorkflowSummary = null;
    }
  }

  return (
    <AppShell title="Dashboard">
      <PageHeader
        title="Overview"
        description="HireLens summarizes your pipeline, match quality, and recent agent activity in one calm view."
      >
        <Link
          href="/jobs"
          className={cn(
            "inline-flex h-10 items-center justify-center rounded-xl border border-border bg-transparent px-4 text-sm font-medium text-foreground transition-all duration-200 hover:border-border-hover hover:bg-muted/50",
          )}
        >
          View jobs
        </Link>
      </PageHeader>
      {usingSample && (
        <p className="mb-6 inline-flex max-w-3xl rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          {sampleReason === "db_partial"
            ? "Sample data — extended dashboard queries failed (often missing tables). Open Diagnostics to fix the database, then refresh."
            : "Sample data — little activity in your account yet (local testing preview)."}
        </p>
      )}

      {!overview ? (
        <Card className="border-score-danger/30">
          <CardHeader>
            <CardTitle>Database unavailable</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Set <code className="rounded-lg bg-muted px-2 py-0.5 font-mono text-xs text-foreground">DATABASE_URL</code>{" "}
            in <code className="rounded-lg bg-muted px-2 py-0.5 font-mono text-xs text-foreground">.env.local</code>,
            run{" "}
            <code className="rounded-lg bg-muted px-2 py-0.5 font-mono text-xs text-foreground">npx prisma db push</code>
            , then refresh. See <Link href="/diagnostics" className="text-primary underline-offset-2 hover:underline">Diagnostics</Link> for connection checks.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_minmax(280px,320px)]">
          <div className="space-y-8">
            {jobsWorkflowSummary ? (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle>Job workflow</CardTitle>
                      <p className="mt-1 text-xs font-normal text-muted-foreground">
                        Same metrics as the Jobs page summary — match + decision hints and tracking for your feed
                        resume (primary or default), max 50 roles after ranking.
                      </p>
                    </div>
                    <Link
                      href="/jobs"
                      className={cn(
                        "shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline",
                      )}
                    >
                      Open jobs
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <JobsSummaryStrip summary={jobsWorkflowSummary} className="mb-0" />
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Decision velocity</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <HeroStat label="Active pipeline jobs" value={String(overview.activeJobs)} />
                <HeroStat
                  label="Average fit signal"
                  value={overview.avgMatchScore === 0 ? "—" : `${Math.round(overview.avgMatchScore * 100)}%`}
                />
                <HeroStat label="High-confidence opportunities" value={String(highMatchJobs)} />
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Active jobs" value={String(overview.activeJobs)} />
              <MetricCard label="Resumes indexed" value={String(overview.resumesIndexed)} />
              <MetricCard label="High match jobs" value={String(highMatchJobs)} />
              <MetricCard
                label="Avg match score"
                value={overview.avgMatchScore === 0 ? "—" : `${Math.round(overview.avgMatchScore * 100)}%`}
              />
              <MetricCard
                label="Avg impact score"
                value={avgImpactScore === 0 ? "—" : `${Math.round(avgImpactScore)}%`}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Matched jobs</CardTitle>
              </CardHeader>
              <CardContent>
                {recentMatches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No match runs yet. Score a resume against jobs to populate this view.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {recentMatches.map((m) => (
                      <li
                        key={m.id}
                        className="flex justify-between gap-4 rounded-lg border border-border px-4 py-3"
                      >
                        <span className="text-foreground">{m.company ? `${m.title} — ${m.company}` : m.title}</span>
                        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {Math.round(m.matchScore * 100)}% · {m.verdict}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
              </CardHeader>
              <CardContent>
                {overview.recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No runs yet. Upload a resume or analyze a job.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {overview.recentActivity.map((a) => (
                      <li
                        key={a.id}
                        className="flex justify-between gap-4 rounded-lg border border-border px-4 py-3"
                      >
                        <span className="text-foreground">{a.label}</span>
                        <span className="shrink-0 text-label">{new Date(a.at).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent tailored resumes</CardTitle>
              </CardHeader>
              <CardContent>
                {recentTailored.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tailored resumes yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {recentTailored.map((t) => (
                      <li
                        key={t.id}
                        className="flex justify-between gap-4 rounded-lg border border-border px-4 py-3"
                      >
                        <span className="text-foreground">{t.company ? `${t.title} — ${t.company}` : t.title}</span>
                        <span className="shrink-0 text-label">{new Date(t.updatedAt).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            {outcomeSnapshot && outcomeSnapshot.recordCount > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Outcomes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex justify-between border-b border-border pb-2">
                    <span className="text-label">Applications tracked</span>
                    <span className="font-medium text-foreground">{outcomeSnapshot.applicationsTracked}</span>
                  </div>
                  <div className="flex justify-between border-b border-border pb-2">
                    <span className="text-label">Interviews</span>
                    <span className="font-medium text-foreground">{outcomeSnapshot.interviews}</span>
                  </div>
                  <div className="flex justify-between border-b border-border pb-2">
                    <span className="text-label">Offers</span>
                    <span className="font-medium text-foreground">{outcomeSnapshot.offers}</span>
                  </div>
                  {outcomeSnapshot.recent.length > 0 && (
                    <div className="pt-1">
                      <p className="mb-2 text-xs font-medium text-label">Recent updates</p>
                      <ul className="space-y-2 text-xs">
                        {outcomeSnapshot.recent.map((r) => (
                          <li key={r.id} className="flex flex-col gap-0.5 rounded-md border border-border/80 px-2 py-1.5">
                            <span className="text-foreground line-clamp-2">{r.label}</span>
                            <span className="text-label">
                              {r.status} · {new Date(r.at).toLocaleDateString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Prioritize roles where match scores stay above your personal baseline — fewer applications, better
                  outcomes.
                </p>
                <p>Use Tailor when a score is close but not quite: small edits often move the needle without noise.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Data health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-label">Indexed resumes</span>
                  <span className="font-medium text-foreground">{overview.resumesIndexed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-label">Jobs tracked</span>
                  <span className="font-medium text-foreground">{overview.activeJobs}</span>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </AppShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-xs font-medium text-label">{label}</p>
        <p className="pt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      </CardHeader>
    </Card>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <p className="text-xs font-medium text-label">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
