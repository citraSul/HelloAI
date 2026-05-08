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
import { defaultResumeIdFromList, orderResumesPrimaryFirst } from "@/lib/resume-default";
import { DecisionClarityStrip } from "@/components/decision-clarity-strip";
import { JobDetailDecisionSyncLine } from "@/components/job-detail-decision-sync";
import { DECISION_TRIAD_READABLE } from "@/lib/decision-ui-labels";

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
  let primaryResumeId: string | null = null;
  try {
    [job, resumes, primaryResumeId] = await Promise.all([
      prisma.job.findFirst({
        where: { id, userId },
      }),
      prisma.resume.findMany({
        where: { userId },
        select: { id: true, title: true },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      prisma.user
        .findUnique({
          where: { id: userId },
          select: { primaryResumeId: true },
        })
        .then((u) => u?.primaryResumeId ?? null),
    ]);
  } catch {
    job = null;
    resumes = [];
    primaryResumeId = null;
  }

  if (!job) notFound();

  let effectiveResumeId: string | null = null;
  let selectedTitle: string | null = null;

  const defaultResumeId = defaultResumeIdFromList(resumes, primaryResumeId);
  const resumesForUi = orderResumesPrimaryFirst(resumes, primaryResumeId);

  if (resumes.length === 0) {
    effectiveResumeId = null;
  } else {
    const valid = resumeIdParam ? resumes.find((r) => r.id === resumeIdParam) : null;
    if (valid) {
      effectiveResumeId = valid.id;
      selectedTitle = valid.title;
    } else if (defaultResumeId) {
      redirect(`/jobs/${id}?resumeId=${encodeURIComponent(defaultResumeId)}`);
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

  const hasFeedMeta = Boolean(job.source || job.applyUrl || job.fetchedAt);

  const sectionLabel =
    "mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-label";

  return (
    <AppShell title={job.title}>
      <PageHeader
        title={job.title}
        description={
          job.company
            ? `${job.company} — ${DECISION_TRIAD_READABLE}, match signal, tailoring, and your pipeline in one place.`
            : `${DECISION_TRIAD_READABLE}, match signal, tailoring, and your pipeline in one place.`
        }
      />
      <DecisionClarityStrip placement="jobDetail" />

      {/* 1. Job overview */}
      <section className="mb-8 border-b border-border/70 pb-6" aria-labelledby="job-detail-overview">
        <h2 id="job-detail-overview" className={sectionLabel}>
          Job overview
        </h2>
        {hasFeedMeta ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {job.source ? (
              <span className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-label">
                Feed: {job.source}
              </span>
            ) : null}
            {job.applyUrl ? (
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Open original listing
              </a>
            ) : null}
            {job.fetchedAt ? (
              <span className="text-muted-foreground">
                Imported {new Date(job.fetchedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Manually added or legacy job — no feed import metadata.</p>
        )}
      </section>

      {/* 2. HireLens recommendation (decision-first) */}
      <section className="mb-8" aria-labelledby="job-detail-recommendation">
        <h2 id="job-detail-recommendation" className={sectionLabel}>
          HireLens recommendation
        </h2>
        <div className="max-w-3xl">
          <DecisionSummaryCard decision={decisionCtx.decision} resumeTitle={selectedTitle} />
          <JobDetailDecisionSyncLine sync={decisionCtx.sync} />
        </div>
      </section>

      {/* 3. Primary actions & tracking */}
      <section className="mb-8" aria-labelledby="job-detail-actions">
        <h2 id="job-detail-actions" className={sectionLabel}>
          Primary actions
        </h2>
        <p className="mb-4 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Choose which resume you are evaluating. Score match updates the match %; Tailor opens the studio. Tracking is
          what actually happened in your search — separate from match % and the action triad.
        </p>
        {resumes.length === 0 ? (
          <JobDetailNoResumeCta />
        ) : (
          <div className="max-w-2xl">
            <JobDetailResumePanel
              jobId={job.id}
              resumes={resumesForUi}
              primaryResumeId={primaryResumeId}
              selectedResumeId={effectiveResumeId!}
              autoScoreIfMissing={!matchForResume}
            />
          </div>
        )}
        {effectiveResumeId != null && selectedTitle ? (
          <div className="mt-6 max-w-2xl border-t border-border/60 pt-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-label">Tracking</h3>
            <ApplicationOutcomePanel
              key={`outcome-${job.id}-${effectiveResumeId}`}
              jobId={job.id}
              resumeId={effectiveResumeId}
              resumeTitle={selectedTitle}
              initial={initialOutcome}
            />
          </div>
        ) : null}
      </section>

      {/* 4. Why this recommendation */}
      <section className="mb-8 border-t border-border/60 pt-8" aria-labelledby="job-detail-why">
        <h2 id="job-detail-why" className={sectionLabel}>
          Why this recommendation
        </h2>
        <p className="mb-4 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Match % and dimensions below explain fit to the posting. They support the action recommendation — they are not
          a second, competing verdict.
        </p>
        {effectiveResumeId == null ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No resume on file. Create one, then run Score match to see a fit signal for this job.
            </CardContent>
          </Card>
        ) : matchForResume ? (
          <div className="mb-6">
            <JobMatchHero
              company={job.company}
              matchScore={matchForResume.matchScore}
              verdict={matchForResume.verdict}
              resumeTitle={selectedTitle}
            />
          </div>
        ) : (
          <Card className="mb-6">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No match score for <span className="font-medium text-foreground">{selectedTitle}</span> yet. A first
              score is requested automatically when you open this page; if nothing appears shortly, use{" "}
              <span className="font-medium text-foreground">Score match</span> in Primary actions.
            </CardContent>
          </Card>
        )}
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-label">Fit breakdown</h3>
        {selectedTitle ? <p className="mb-3 text-xs text-muted-foreground">For resume: {selectedTitle}</p> : null}
        <MatchBreakdownPanels breakdown={breakdown} />
      </section>

      {/* 5. Advanced analysis */}
      <section className="border-t border-border/60 pt-8" aria-labelledby="job-detail-advanced">
        <h2 id="job-detail-advanced" className={sectionLabel}>
          Advanced analysis
        </h2>
        <details className="rounded-xl border border-border/60 bg-muted/[0.05] px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Open advanced details (description, role analysis, and match history)
          </summary>
          <p className="mb-6 mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Full posting text, structured role analysis from ingestion, and score history for deep review.
          </p>
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
              {selectedTitle ? (
                <p className="text-xs font-normal text-muted-foreground">For resume: {selectedTitle}</p>
              ) : null}
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
        </details>
      </section>
    </AppShell>
  );
}
