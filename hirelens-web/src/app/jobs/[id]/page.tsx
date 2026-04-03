import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { loadDecisionForJobDetail } from "@/lib/services/decision-service";
import { resolveUserId } from "@/lib/services/user";
import { notFound, redirect } from "next/navigation";
import { JobMatchHero } from "@/components/job-match-hero";
import { MatchBreakdownPanels } from "@/components/match-breakdown";
import { JobDetailNoResumeCta, JobDetailResumePanel } from "@/components/job-detail-resume-panel";
import { DecisionSummaryCard } from "@/components/decision-summary-card";
import { ApplicationOutcomePanel } from "@/components/application-outcome-panel";
import { getOutcomeForJobResume } from "@/lib/services/application-outcome-service";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const rawResume = sp.resumeId;
  const resumeIdParam = Array.isArray(rawResume) ? rawResume[0] : rawResume;

  const userId = await resolveUserId();

  let job: Awaited<ReturnType<typeof prisma.job.findFirst>>;
  let resumes: Array<{ id: string; title: string }>;
  try {
    [job, resumes] = await Promise.all([
      prisma.job.findFirst({
        where: { id, userId },
      }),
      prisma.resume.findMany({
        where: { userId },
        select: { id: true, title: true },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
    ]);
  } catch {
    job = null;
    resumes = [];
  }

  if (!job) notFound();

  let effectiveResumeId: string | null = null;
  let selectedTitle: string | null = null;

  if (resumes.length === 0) {
    effectiveResumeId = null;
  } else {
    const valid = resumeIdParam ? resumes.find((r) => r.id === resumeIdParam) : null;
    if (valid) {
      effectiveResumeId = valid.id;
      selectedTitle = valid.title;
    } else {
      redirect(`/jobs/${id}?resumeId=${encodeURIComponent(resumes[0].id)}`);
    }
  }

  let decisionCtx: Awaited<ReturnType<typeof loadDecisionForJobDetail>>;
  let initialOutcome: Awaited<ReturnType<typeof getOutcomeForJobResume>> | null = null;
  let matchForResume;
  let matchHistoryForResume: Awaited<ReturnType<typeof prisma.matchAnalysis.findMany>>;

  if (effectiveResumeId) {
    const [d, outcome, match, history] = await Promise.all([
      loadDecisionForJobDetail(userId, id, effectiveResumeId, selectedTitle),
      getOutcomeForJobResume(userId, id, effectiveResumeId).catch(() => null),
      prisma.matchAnalysis.findFirst({
        where: { userId, jobId: id, resumeId: effectiveResumeId },
        orderBy: { createdAt: "desc" },
        include: { resume: true },
      }),
      prisma.matchAnalysis.findMany({
        where: { userId, jobId: id, resumeId: effectiveResumeId },
        orderBy: { createdAt: "desc" },
        include: { resume: true },
      }),
    ]);
    decisionCtx = d;
    initialOutcome = outcome;
    matchForResume = match;
    matchHistoryForResume = history;
  } else {
    decisionCtx = await loadDecisionForJobDetail(userId, id, null, null);
    matchForResume = null;
    matchHistoryForResume = [];
  }

  const analyzed = job.analyzedJson as Record<string, unknown> | null;
  const breakdown = matchForResume?.breakdown;

  return (
    <AppShell title={job.title}>
      <PageHeader
        title={job.title}
        description={job.company ? `${job.company}` : "Job detail, match signal, and role analysis."}
      />

      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {resumes.length === 0 ? (
            <JobDetailNoResumeCta />
          ) : (
            <JobDetailResumePanel jobId={job.id} resumes={resumes} selectedResumeId={effectiveResumeId!} />
          )}
        </div>
        <div className="w-full shrink-0 lg:w-[360px]">
          <DecisionSummaryCard
            decision={decisionCtx.decision}
            title="Application decision"
            resumeTitle={selectedTitle}
          />
        </div>
      </div>

      {effectiveResumeId != null && selectedTitle && (
        <div className="mb-8">
          <ApplicationOutcomePanel
            key={`outcome-${job.id}-${effectiveResumeId}`}
            jobId={job.id}
            resumeId={effectiveResumeId}
            resumeTitle={selectedTitle}
            initial={initialOutcome}
          />
        </div>
      )}

      {effectiveResumeId == null ? (
        <Card className="mb-8">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No resume on file. Create one, then run Score match to see a fit signal for this job.
          </CardContent>
        </Card>
      ) : matchForResume ? (
        <div className="mb-8">
          <JobMatchHero
            company={job.company}
            matchScore={matchForResume.matchScore}
            verdict={matchForResume.verdict}
            resumeTitle={selectedTitle}
          />
        </div>
      ) : (
        <Card className="mb-8">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No match score for <span className="font-medium text-foreground">{selectedTitle}</span> yet. Use{" "}
            <span className="font-medium text-foreground">Score match</span> above for this resume.
          </CardContent>
        </Card>
      )}

      <div className="mb-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-label">Fit breakdown</h2>
        {selectedTitle && <p className="mb-3 text-xs text-muted-foreground">For resume: {selectedTitle}</p>}
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
          {selectedTitle && (
            <p className="text-xs font-normal text-muted-foreground">For resume: {selectedTitle}</p>
          )}
        </CardHeader>
        <CardContent>
          {effectiveResumeId == null ? (
            <p className="text-sm text-muted-foreground">Add a resume to see history.</p>
          ) : matchHistoryForResume.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scores yet for this resume on this job.</p>
          ) : (
            <ul className="space-y-2">
              {matchHistoryForResume.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <span className="text-sm text-foreground">{new Date(m.createdAt).toLocaleString()}</span>
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
