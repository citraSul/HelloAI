import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { getDashboardOverview } from "@/lib/services/dashboard-service";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let overview;
  try {
    overview = await getDashboardOverview();
  } catch {
    overview = null;
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
            , then refresh.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_minmax(280px,320px)]">
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Active jobs" value={String(overview.activeJobs)} />
              <MetricCard label="Resumes indexed" value={String(overview.resumesIndexed)} />
              <MetricCard
                label="Avg match score"
                value={overview.avgMatchScore === 0 ? "—" : `${Math.round(overview.avgMatchScore * 100)}%`}
              />
              <MetricCard
                label="Last agent run"
                value={overview.lastRunAt ? new Date(overview.lastRunAt).toLocaleString() : "—"}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
              </CardHeader>
              <CardContent>
                {overview.recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No runs yet. Upload a resume or analyze a job.</p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {overview.recentActivity.map((a) => (
                      <li
                        key={a.id}
                        className="flex justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0"
                      >
                        <span className="text-foreground">{a.label}</span>
                        <span className="shrink-0 text-label">{new Date(a.at).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
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
        <p className="text-xs font-medium uppercase tracking-wide text-label">{label}</p>
        <p className="pt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      </CardHeader>
    </Card>
  );
}
