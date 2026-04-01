import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { EmptyState } from "@/components/empty-state";
import { FileText } from "lucide-react";

const resumeInclude = { parsed: true } satisfies Prisma.ResumeInclude;
type ResumeWithParsed = Prisma.ResumeGetPayload<{ include: typeof resumeInclude }>;

export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  let resumes: ResumeWithParsed[] = [];
  let loadError = false;
  try {
    resumes = await prisma.resume.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: resumeInclude,
    });
  } catch {
    loadError = true;
  }

  return (
    <AppShell title="Resumes">
      <PageHeader title="Resume library" description="Uploaded resumes and parsed profile snapshots." />
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
        <ul className="space-y-4">
          {resumes.map((r) => (
            <li key={r.id}>
              <Card>
                <CardContent className="py-6">
                  <p className="font-semibold text-foreground">{r.title}</p>
                  <p className="mt-1 font-mono text-xs text-label">ID: {r.id}</p>
                  {r.parsed && (
                    <pre className="mt-4 max-h-44 overflow-auto rounded-xl border border-border bg-muted/50 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
                      {JSON.stringify(r.parsed.data, null, 2)}
                    </pre>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
