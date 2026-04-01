import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Briefcase } from "lucide-react";
import { ScoreBadge } from "@/components/score-badge";

const jobListInclude = {
  matchAnalyses: { orderBy: { createdAt: "desc" as const }, take: 1 },
} satisfies Prisma.JobInclude;

type JobWithLatest = Prisma.JobGetPayload<{ include: typeof jobListInclude }>;

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  let jobs: JobWithLatest[] = [];
  let loadError = false;
  try {
    jobs = await prisma.job.findMany({
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
      <PageHeader title="Jobs" description="Roles you track and the latest match signal for each." />
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
        <ul className="space-y-4">
          {jobs.map((job) => {
            const latest = job.matchAnalyses[0];
            return (
              <li key={job.id}>
                <Link href={`/jobs/${job.id}`} className="block">
                  <Card className="transition-all duration-200 hover:border-border-hover hover:shadow-card">
                    <CardContent className="flex items-center justify-between gap-4 py-5">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{job.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{job.company ?? "Company TBD"}</p>
                      </div>
                      {latest ? (
                        <ScoreBadge score={latest.matchScore} verdict={latest.verdict} />
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
