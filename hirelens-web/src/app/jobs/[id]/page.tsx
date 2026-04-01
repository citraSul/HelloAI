import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { JobMatchHero } from "@/components/job-match-hero";
import { MatchBreakdownPanels } from "@/components/match-breakdown";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let job;
  try {
    job = await prisma.job.findUnique({
      where: { id },
      include: {
        matchAnalyses: { orderBy: { createdAt: "desc" }, include: { resume: true } },
      },
    });
  } catch {
    job = null;
  }

  if (!job) notFound();

  const analyzed = job.analyzedJson as Record<string, unknown> | null;
  const latest = job.matchAnalyses[0];
  const breakdown = latest?.breakdown;

  return (
    <AppShell title={job.title}>
      <PageHeader
        title={job.title}
        description={job.company ? `${job.company}` : "Job detail, match signal, and role analysis."}
      />

      {latest ? (
        <div className="mb-8">
          <JobMatchHero company={job.company} matchScore={latest.matchScore} verdict={latest.verdict} />
        </div>
      ) : (
        <Card className="mb-8">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No match score yet. Run <span className="font-medium text-foreground">Score match</span> from Tailor or the
            API to see your signal here.
          </CardContent>
        </Card>
      )}

      <div className="mb-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-label">Fit breakdown</h2>
        <MatchBreakdownPanels breakdown={breakdown} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-muted/40 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {job.rawDescription}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role analysis</CardTitle>
          </CardHeader>
          <CardContent>
            {analyzed ? (
              <pre className="max-h-96 overflow-auto rounded-xl bg-muted/40 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
                {JSON.stringify(analyzed, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">Not analyzed yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Match history</CardTitle>
        </CardHeader>
        <CardContent>
          {job.matchAnalyses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scores yet.</p>
          ) : (
            <ul className="space-y-3">
              {job.matchAnalyses.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
                >
                  <span className="text-sm text-foreground">Resume: {m.resume.title}</span>
                  <span className="tabular-nums text-sm text-muted-foreground">
                    {Math.round(m.matchScore * 100)}% · {m.verdict}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
