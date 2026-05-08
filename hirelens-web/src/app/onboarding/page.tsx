import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/onboarding");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      primaryResumeId: true,
      resumes: { select: { id: true }, take: 1 },
    },
  });

  if (user?.primaryResumeId) {
    redirect("/dashboard");
  }

  const hasResume = (user?.resumes.length ?? 0) > 0;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16 sm:py-24">
      <Card className="w-full max-w-lg border-border/55 shadow-brand-soft">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl tracking-[-0.02em]">Welcome to HireLens</CardTitle>
          <CardDescription>
            Set a <strong className="font-medium text-foreground">primary resume</strong> so the Jobs list, decision
            hints, and default job scoring all reference the profile you intend — not your most recently edited file by
            accident.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasResume ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              You already have a resume on file. Open the library and mark one as primary, or add another
              resume if you prefer.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Add your first resume (paste text is fine). We&apos;ll set it as your primary automatically
              unless you choose another later.
            </p>
          )}
          <Link
            href="/resumes"
            className={cn(
              "inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary-hover hover:shadow-brand-soft",
            )}
          >
            {hasResume ? "Open resume library" : "Add your first resume"}
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            You can skip for now, but scoring and recommendations work best with a primary resume.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
