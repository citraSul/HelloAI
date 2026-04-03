import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { AnalyticsBarChart } from "@/components/analytics-bar-chart";
import { resolveUserId } from "@/lib/services/user";
import { normalizeImpactMetrics } from "@/lib/services/normalize-impact-metrics";
import {
  computeOutcomeInsights,
  getOutcomeAnalyticsForUser,
} from "@/lib/services/application-outcome-service";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const userId = await resolveUserId();
  let metricsCount = 0;
  let jobsAnalyzed = 0;
  let highMatchJobs = 0;
  let avgImpactScore = 0;
  let applicationsSent = 0;
  let usingSample = false;
  let sampleReason: "sparse" | "db_error" | null = null;
  let runsByAgent: { agentName: string; count: number }[] = [];
  let funnelRows: Array<{ label: string; value: number }> = [];
  let trendRows: Array<{ label: string; value: number }> = [];
  let outcomeRejected = 0;
  let responseRatePct: number | null = null;
  let interviewRatePct: number | null = null;
  let offerRatePct: number | null = null;
  let trackedApplications = 0;
  let insightLines: string[] = [];

  try {
    const [impactCount, grouped, decisions, matches, impacts, outcomeAnalytics, insights] = await Promise.all([
      prisma.impactMetric.count({ where: { userId } }),
      prisma.agentRun.groupBy({
        by: ["agentName"],
        where: { userId },
        _count: { id: true },
      }),
      prisma.decisionAnalysis.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.matchAnalysis.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.impactMetric.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      getOutcomeAnalyticsForUser(userId),
      computeOutcomeInsights(userId),
    ]);
    metricsCount = impactCount;
    runsByAgent = grouped.map((g) => ({ agentName: g.agentName, count: g._count.id }));
    jobsAnalyzed = new Set(matches.map((m) => m.jobId)).size;
    highMatchJobs = new Set(matches.filter((m) => m.matchScore >= 0.72).map((m) => m.jobId)).size;
    applicationsSent = decisions.filter((d) => d.recommendation === "apply").length;
    const impactScores = impacts
      .map((i) => normalizeImpactMetrics(i.metrics).impact_score)
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    avgImpactScore =
      impactScores.length > 0 ? impactScores.reduce((sum, n) => sum + n, 0) / impactScores.length : 0;

    trackedApplications = outcomeAnalytics.funnelApplied;
    outcomeRejected = outcomeAnalytics.countRejected;
    funnelRows = [
      { label: "Applied", value: outcomeAnalytics.funnelApplied },
      { label: "Responded", value: outcomeAnalytics.funnelResponded },
      { label: "Interviewed", value: outcomeAnalytics.funnelInterviewed },
      { label: "Offered", value: outcomeAnalytics.funnelOffered },
    ];
    responseRatePct =
      outcomeAnalytics.responseRate != null ? Math.round(outcomeAnalytics.responseRate * 100) : null;
    interviewRatePct =
      outcomeAnalytics.interviewRate != null ? Math.round(outcomeAnalytics.interviewRate * 100) : null;
    offerRatePct = outcomeAnalytics.offerRate != null ? Math.round(outcomeAnalytics.offerRate * 100) : null;
    insightLines = insights.map((i) => i.text);

    const recentMatches = matches.slice(0, 12);
    const buckets = new Map<string, { sum: number; count: number }>();
    for (const m of recentMatches) {
      const d = new Date(m.createdAt);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      const cur = buckets.get(key) ?? { sum: 0, count: 0 };
      cur.sum += m.matchScore;
      cur.count += 1;
      buckets.set(key, cur);
    }
    trendRows = Array.from(buckets.entries()).map(([label, v]) => ({
      label,
      value: Math.round((v.sum / v.count) * 100),
    }));
  } catch {
    usingSample = true;
    sampleReason = "db_error";
    metricsCount = 18;
    jobsAnalyzed = 24;
    highMatchJobs = 9;
    avgImpactScore = 73;
    applicationsSent = 12;
    trackedApplications = 12;
    outcomeRejected = 2;
    responseRatePct = 58;
    interviewRatePct = 41;
    offerRatePct = 32;
    insightLines = ["More outcome data is needed for personalized insights."];
    runsByAgent = [
      { agentName: "match_score_agent", count: 38 },
      { agentName: "resume_tailor_agent", count: 21 },
      { agentName: "impact_eval_agent", count: 18 },
      { agentName: "decision_engine", count: 17 },
    ];
    funnelRows = [
      { label: "Applied", value: 12 },
      { label: "Responded", value: 7 },
      { label: "Interviewed", value: 3 },
      { label: "Offered", value: 1 },
    ];
    trendRows = [
      { label: "3/12", value: 64 },
      { label: "3/14", value: 67 },
      { label: "3/16", value: 70 },
      { label: "3/18", value: 72 },
      { label: "3/20", value: 75 },
    ];
  }

  if (!sampleReason) {
    const nearEmpty =
      metricsCount < 2 &&
      runsByAgent.length < 2 &&
      jobsAnalyzed < 2 &&
      trendRows.length < 3 &&
      applicationsSent < 2 &&
      trackedApplications < 1;
    if (nearEmpty) {
      usingSample = true;
      sampleReason = "sparse";
      metricsCount = 18;
      jobsAnalyzed = 24;
      highMatchJobs = 9;
      avgImpactScore = 73;
      applicationsSent = 12;
      trackedApplications = 12;
      outcomeRejected = 2;
      responseRatePct = 58;
      interviewRatePct = 41;
      offerRatePct = 32;
      insightLines = ["More outcome data is needed for personalized insights."];
      runsByAgent = [
        { agentName: "match_score_agent", count: 38 },
        { agentName: "resume_tailor_agent", count: 21 },
        { agentName: "impact_eval_agent", count: 18 },
        { agentName: "decision_engine", count: 17 },
      ];
      funnelRows = [
        { label: "Applied", value: 12 },
        { label: "Responded", value: 7 },
        { label: "Interviewed", value: 3 },
        { label: "Offered", value: 1 },
      ];
      trendRows = [
        { label: "3/12", value: 64 },
        { label: "3/14", value: 67 },
        { label: "3/16", value: 70 },
        { label: "3/18", value: 72 },
        { label: "3/20", value: 75 },
      ];
    }
  }

  const chartRows = runsByAgent.map((r) => ({ label: r.agentName.replace(/_/g, " "), value: r.count }));

  return (
    <AppShell title="Analytics">
      <PageHeader
        title="Analytics"
        description="Pipeline activity, real application outcomes, and match trends — scoped to your account."
      />
      {usingSample && (
        <p className="mb-6 inline-flex max-w-3xl rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          {sampleReason === "db_error"
            ? "Sample data — analytics queries failed (database misconfiguration or missing tables). Open Diagnostics, run prisma db push, then refresh."
            : "Sample data — little activity in your account yet (local testing preview)."}
        </p>
      )}

      <div className="space-y-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Pipeline performance</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <HeroStat label="Jobs analyzed" value={jobsAnalyzed} />
              <HeroStat label="High match jobs" value={highMatchJobs} />
              <HeroStat label="Tracked applications" value={trackedApplications} />
              <HeroStat label="Avg impact score" value={Math.round(avgImpactScore)} suffix="%" />
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Apply recommendations" value={applicationsSent} />
            <MetricCard label="Tracked applications" value={trackedApplications} />
            <MetricCard label="Rejected (tracked)" value={outcomeRejected} />
            <MetricCard
              label="Response rate"
              value={responseRatePct != null ? responseRatePct : "—"}
              suffix={responseRatePct != null ? "%" : undefined}
            />
            <MetricCard
              label="Interview rate"
              value={interviewRatePct != null ? interviewRatePct : "—"}
              suffix={interviewRatePct != null ? "%" : undefined}
            />
            <MetricCard
              label="Offer rate"
              value={offerRatePct != null ? offerRatePct : "—"}
              suffix={offerRatePct != null ? "%" : undefined}
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Outcome insights</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                  {insightLines.map((line, i) => (
                    <li key={i} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">
                      {line}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Impact &amp; agents</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-label">Impact evaluations</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{metricsCount}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-label">Agent runs (top)</p>
                  {runsByAgent.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">None yet.</p>
                  ) : (
                    <AnalyticsBarChart rows={chartRows} />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Application funnel (recorded outcomes)</CardTitle>
              </CardHeader>
              <CardContent>
                {funnelRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No funnel data yet.</p>
                ) : (
                  <AnalyticsBarChart rows={funnelRows} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Match score trend</CardTitle>
              </CardHeader>
              <CardContent>
                {trendRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No trend points yet.</p>
                ) : (
                  <AnalyticsBarChart rows={trendRows} max={100} />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
    </AppShell>
  );
}

function MetricCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-xs font-medium text-label">{label}</p>
        <p className="pt-1 text-2xl font-bold tabular-nums text-foreground">
          {value}
          {suffix ?? ""}
        </p>
      </CardHeader>
    </Card>
  );
}

function HeroStat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <p className="text-xs font-medium text-label">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {value}
        {suffix ?? ""}
      </p>
    </div>
  );
}
