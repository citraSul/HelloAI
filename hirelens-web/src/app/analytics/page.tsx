import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { AnalyticsBarChart } from "@/components/analytics-bar-chart";
import { ImpactBadge } from "@/components/score-badge";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  let metricsCount = 0;
  let runsByAgent: { agentName: string; count: number }[] = [];
  let loadError = false;

  try {
    metricsCount = await prisma.impactMetric.count();
    const grouped = await prisma.agentRun.groupBy({
      by: ["agentName"],
      _count: { id: true },
    });
    runsByAgent = grouped.map((g) => ({ agentName: g.agentName, count: g._count.id }));
  } catch {
    loadError = true;
  }

  const chartRows = runsByAgent.map((r) => ({ label: r.agentName.replace(/_/g, " "), value: r.count }));

  return (
    <AppShell title="Analytics">
      <PageHeader
        title="Analytics"
        description="Impact volume and agent usage — quiet, readable charts so you focus on what changed."
      />

      {loadError ? (
        <p className="text-sm text-muted-foreground">Connect the database to see analytics.</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Impact evaluations</CardTitle>
              <ImpactBadge label="Impact" />
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold tabular-nums text-foreground">{metricsCount}</p>
              <p className="mt-2 text-sm text-muted-foreground">Total impact metric records</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Agent runs</CardTitle>
            </CardHeader>
            <CardContent>
              {runsByAgent.length === 0 ? (
                <p className="text-sm text-muted-foreground">No agent runs yet.</p>
              ) : (
                <AnalyticsBarChart rows={chartRows} />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
