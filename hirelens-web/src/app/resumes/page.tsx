import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { EmptyState } from "@/components/empty-state";
import { FileText } from "lucide-react";
import { ResumeCreateForm } from "@/components/resume-create-form";
import { resolveUserId } from "@/lib/services/user";
import { cn } from "@/lib/utils/cn";
import { ResumePrimaryControls } from "@/components/resume-primary-controls";

const resumeInclude = { parsed: true } satisfies Prisma.ResumeInclude;
type ResumeWithParsed = Prisma.ResumeGetPayload<{ include: typeof resumeInclude }>;

function formatYearsExperience(years: number): string {
  const n = Math.round(years);
  if (n === 1) return "1 year experience";
  return `${n} years experience`;
}

function normalizeSkills(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim());
}

/**
 * Renders stored `ParsedResumeProfile.data` (JSON) defensively — shape may evolve beyond the mock parser.
 */
function ParsedResumeProfile({ data }: { data: unknown }) {
  const obj = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  const headline = obj && typeof obj.headline === "string" ? obj.headline.trim() : "";
  const summary = obj && typeof obj.summary === "string" ? obj.summary.trim() : "";
  const skills = obj ? normalizeSkills(obj.skills) : [];

  let yearsLine: string | null = null;
  if (obj && typeof obj.yearsExperience === "number" && Number.isFinite(obj.yearsExperience) && obj.yearsExperience >= 0) {
    yearsLine = formatYearsExperience(obj.yearsExperience);
  }

  const hasStructured = Boolean(headline || summary || skills.length > 0 || yearsLine);

  if (!hasStructured) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        No structured profile fields were found on this snapshot.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      {headline ? <h3 className="text-lg font-semibold leading-snug text-foreground">{headline}</h3> : null}
      {yearsLine ? <p className="text-sm text-muted-foreground">{yearsLine}</p> : null}
      {summary ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
      ) : null}
      {skills.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-label">Skills</p>
          <ul className="flex flex-wrap gap-2" aria-label="Skills">
            {skills.map((skill, i) => (
              <li key={`${skill}-${i}`}>
                <span
                  className={cn(
                    "inline-flex rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground",
                  )}
                >
                  {skill}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  const userId = await resolveUserId();
  let resumes: ResumeWithParsed[] = [];
  let primaryResumeId: string | null = null;
  let loadError = false;
  try {
    const [rows, user] = await Promise.all([
      prisma.resume.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: resumeInclude,
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { primaryResumeId: true },
      }),
    ]);
    resumes = rows;
    primaryResumeId = user?.primaryResumeId ?? null;
  } catch {
    loadError = true;
  }

  return (
    <AppShell title="Resumes">
      <PageHeader
        title="Resume library"
        description="Uploaded resumes and parsed profile snapshots. The primary resume is used first on job pages when no resume is in the URL."
      />
      <div className="mb-8">
        <ResumeCreateForm />
      </div>
      {loadError ? (
        <EmptyState
          icon={FileText}
          title="Could not load resumes"
          description="Configure PostgreSQL and DATABASE_URL, then run npx prisma db push."
        />
      ) : resumes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No resumes yet"
          description="POST to /api/resume/upload with title and rawText to add your first resume."
        />
      ) : (
        <ul className="space-y-3">
          {resumes.map((r) => (
            <li key={r.id}>
              <Card>
                <CardContent className="py-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-foreground">{r.title}</p>
                    <ResumePrimaryControls resumeId={r.id} isPrimary={primaryResumeId === r.id} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-label">ID: {r.id}</p>
                  {r.parsed ? <ParsedResumeProfile data={r.parsed.data} /> : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
