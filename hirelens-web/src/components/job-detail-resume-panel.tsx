"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";

type ResumeOpt = { id: string; title: string };

/** Dedupes auto-score across React Strict Mode double-invoke and stray re-renders (per job+resume per session). */
const autoScoreAttemptedKeys = new Set<string>();

function autoScoreKey(jobId: string, resumeId: string) {
  return `${jobId}\0${resumeId}`;
}

/**
 * Resume selector + Score match, URL-synced via ?resumeId= so reload/share keep context.
 */
export function JobDetailResumePanel({
  jobId,
  resumes,
  selectedResumeId,
  primaryResumeId,
  autoScoreIfMissing = false,
}: {
  jobId: string;
  resumes: ResumeOpt[];
  /** From URL (server-validated) — must match a row in `resumes`. */
  selectedResumeId: string;
  /** User default when opening a job without `?resumeId=` (shown in copy and option labels). */
  primaryResumeId?: string | null;
  /** When true, POST /api/match/score once on load if there is no stored match yet (server-derived). */
  autoScoreIfMissing?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const resumeId = selectedResumeId;

  const setResume = useCallback(
    (id: string) => {
      router.push(`${pathname}?resumeId=${encodeURIComponent(id)}`);
    },
    [router, pathname],
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const runScore = useCallback(async (): Promise<boolean> => {
    if (!resumeId) return false;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/match/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setSuccess(true);
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Score failed");
      return false;
    } finally {
      setLoading(false);
    }
  }, [resumeId, jobId, router]);

  useEffect(() => {
    if (!autoScoreIfMissing || !resumeId) return;
    const key = autoScoreKey(jobId, resumeId);
    if (autoScoreAttemptedKeys.has(key)) return;
    autoScoreAttemptedKeys.add(key);
    void runScore().then((ok) => {
      if (!ok) autoScoreAttemptedKeys.delete(key);
    });
  }, [autoScoreIfMissing, jobId, resumeId, runScore]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Score match</CardTitle>
        <p className="text-sm font-normal text-muted-foreground">
          Uses the resume selected below — same context as the application decision card. Your primary resume is
          chosen first when you open a job without a resume in the URL; you can switch anytime below.
          {autoScoreIfMissing
            ? " A first score runs automatically when you open this page if none exists yet."
            : null}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-label">
            Decision for resume
          </label>
          <select
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-3 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/25"
            value={resumeId}
            onChange={(e) => setResume(e.target.value)}
          >
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
                {primaryResumeId && r.id === primaryResumeId ? " (primary)" : ""}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-score-danger">{error}</p>}
        {success && !error && <p className="text-sm text-score-success">Match saved. Updating…</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            disabled={loading || !resumeId}
            onClick={() => void runScore()}
            className="w-full sm:w-auto"
          >
            {loading ? "Scoring…" : "Score match"}
          </Button>
          <Link
            href={`/tailor?jobId=${encodeURIComponent(jobId)}&resumeId=${encodeURIComponent(resumeId)}`}
            className={cn(
              "inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-transparent px-4 text-sm font-medium text-foreground transition-all duration-200 hover:border-border-hover hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto",
            )}
          >
            Tailor this resume
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function JobDetailNoResumeCta() {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base">Score match</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>Create a resume to evaluate this job and unlock apply / maybe / skip guidance for that resume.</p>
        <Link
          href="/resumes"
          className={cn(
            "inline-flex h-9 items-center justify-center rounded-lg border border-border bg-transparent px-3 text-sm font-medium text-foreground transition-all duration-200 hover:border-border-hover hover:bg-muted/40",
          )}
        >
          Go to Resume library
        </Link>
      </CardContent>
    </Card>
  );
}
