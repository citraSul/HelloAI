import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Briefcase } from "lucide-react";
import { ScoreBadge } from "@/components/score-badge";
import { DecisionListBadge } from "@/components/decision-list-badge";
import { JobCreateForm } from "@/components/job-create-form";
import { resolveUserId } from "@/lib/services/user";
import { cn } from "@/lib/utils/cn";

const jobListInclude = {
  matchAnalyses: { orderBy: { createdAt: "desc" as const }, take: 1 },
} satisfies Prisma.JobInclude;

type JobWithLatest = Prisma.JobGetPayload<{ include: typeof jobListInclude }>;

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const userId = await resolveUserId();
  let jobs: JobWithLatest[] = [];
  let loadError = false;
  try {
    jobs = await prisma.job.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: jobListInclude,
    });
  } catch {
    loadError = true;
    jobs = [];
  }

  return (
    <AppShell title="Jobs">
      <PageHeader title="Jobs" description="Roles you track and the latest match signal for each.">
        <Link
          href="/analytics"
          className={cn(
            "inline-flex h-10 items-center justify-center rounded-xl border border-border bg-transparent px-4 text-sm font-medium text-foreground transition-all duration-200 hover:border-border-hover hover:bg-muted/50",
          )}
        >
          View analytics
        </Link>
      </PageHeader>
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
          description="POST to /api/jobs/analyze with title, company, and rawDescription to add a role."
        />
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => {
            const latest = job.matchAnalyses[0];
            return (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className={cn(
                    "block cursor-pointer rounded-xl",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
                  )}
                >
                  <Card className="transition-all duration-200 hover:border-border-hover hover:shadow-card">
                    <CardContent className="flex items-center justify-between gap-4 py-5">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{job.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{job.company ?? "Company TBD"}</p>
                      </div>
                      {latest ? (
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          <DecisionListBadge matchScore={latest.matchScore} />
                          <ScoreBadge score={latest.matchScore} verdict={latest.verdict} />
                        </div>
                      ) : (
                        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-label">
                          No score yet
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
