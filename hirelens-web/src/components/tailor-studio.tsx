"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { parseResumeSections } from "@/lib/resume/parse-sections";
import { TailoredDiffText } from "@/lib/resume/diff-render";
import { cn } from "@/lib/utils/cn";
import { TailorDecisionSection } from "@/components/decision-recommendation-card";
import { DecisionEngineCompact } from "@/components/decision-summary-card";
import { normalizeImpactMetrics } from "@/lib/services/normalize-impact-metrics";
import type { DecisionOutput } from "@/lib/types/decision";
import { normalizedImpactMetricsSchema, type NormalizedImpactMetrics } from "@/lib/types/impact-metrics";
import { Download, Lock, RefreshCw, Sparkles, Wand2, Zap } from "lucide-react";

type Opt = { id: string; label: string };
type JobOpt = Opt & { title: string; company: string | null };

type TailorMeta = {
  jobTitle: string;
  company: string | null;
  originalText: string;
  tailoredText: string;
  changeLog: { section: string; summary: string; detail?: string }[];
  warnings: string[];
};

function buildTailorSearch(resumeId: string, jobId: string) {
  const params = new URLSearchParams();
  if (resumeId) params.set("resumeId", resumeId);
  if (jobId) params.set("jobId", jobId);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function readListErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body?.error === "string" && body.error.trim()) return body.error;
  } catch {
    /* ignore non-JSON or empty body */
  }
  return fallback;
}

export function TailorStudio({ mockMode = false }: { mockMode?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [resumes, setResumes] = useState<Opt[]>([]);
  const [jobs, setJobs] = useState<JobOpt[]>([]);
  const [listsReady, setListsReady] = useState(false);
  const [resumeId, setResumeId] = useState("");
  const [jobId, setJobId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumesLoadError, setResumesLoadError] = useState<string | null>(null);
  const [jobsLoadError, setJobsLoadError] = useState<string | null>(null);

  const [originalText, setOriginalText] = useState("");
  const [tailoredText, setTailoredText] = useState("");
  const [meta, setMeta] = useState<TailorMeta | null>(null);
  const [lastTailoredId, setLastTailoredId] = useState<string | null>(null);

  const [atsBefore, setAtsBefore] = useState<number | null>(null);
  const [atsAfter, setAtsAfter] = useState<number | null>(null);
  const [impactScore, setImpactScore] = useState<number | null>(null);
  const [keywordGain, setKeywordGain] = useState<number | null>(null);
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const [decisionMetrics, setDecisionMetrics] = useState<NormalizedImpactMetrics | null>(null);
  const [impactRunCompleted, setImpactRunCompleted] = useState(false);
  const [impactParseWarning, setImpactParseWarning] = useState<string | null>(null);
  const [engineDecision, setEngineDecision] = useState<DecisionOutput | null>(null);
  const [engineLoading, setEngineLoading] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);

  const [locked, setLocked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadResumes() {
      setResumesLoadError(null);
      try {
        const res = await fetch("/api/data/resumes");
        if (cancelled) return;
        if (res.ok) {
          const d = await res.json();
          setResumes(Array.isArray(d.items) ? d.items : []);
        } else {
          setResumes([]);
          setResumesLoadError(await readListErrorMessage(res, "Could not load resumes."));
        }
      } catch {
        if (!cancelled) {
          setResumes([]);
          setResumesLoadError("Could not load resumes.");
        }
      }
    }

    async function loadJobs() {
      setJobsLoadError(null);
      try {
        const res = await fetch("/api/data/jobs");
        if (cancelled) return;
        if (res.ok) {
          const d = await res.json();
          setJobs(Array.isArray(d.items) ? d.items : []);
        } else {
          setJobs([]);
          setJobsLoadError(await readListErrorMessage(res, "Could not load jobs."));
        }
      } catch {
        if (!cancelled) {
          setJobs([]);
          setJobsLoadError("Could not load jobs.");
        }
      }
    }

    (async () => {
      await Promise.all([loadResumes(), loadJobs()]);
      if (!cancelled) setListsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Deep link + back/forward: selection follows ?resumeId= & ?jobId=. */
  useEffect(() => {
    if (!listsReady) return;

    const r = searchParams.get("resumeId") ?? "";
    const j = searchParams.get("jobId") ?? "";

    const rValid = r && resumes.some((x) => x.id === r);
    const jValid = j && jobs.some((x) => x.id === j);

    if ((r && !rValid) || (j && !jValid)) {
      const cleanR = rValid ? r : "";
      const cleanJ = jValid ? j : "";
      router.replace(`${pathname}${buildTailorSearch(cleanR, cleanJ)}`, { scroll: false });
      return;
    }

    if (r !== resumeId) {
      setResumeId(r);
      setTailoredText("");
      setMeta(null);
      setDecisionMetrics(null);
      setImpactRunCompleted(false);
      setImpactParseWarning(null);
      setEngineDecision(null);
      setEngineError(null);
    }
    if (j !== jobId) {
      setJobId(j);
      setLastTailoredId(null);
      setTailoredText("");
      setMeta(null);
      setDecisionMetrics(null);
      setImpactRunCompleted(false);
      setImpactParseWarning(null);
      setAtsBefore(null);
      setAtsAfter(null);
      setImpactScore(null);
      setKeywordGain(null);
      setMissingKeywords([]);
      setEngineDecision(null);
      setEngineError(null);
    }
  }, [listsReady, searchParams, resumes, jobs, router, pathname, resumeId, jobId]);

  useEffect(() => {
    if (!resumeId) {
      setOriginalText("");
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/data/resume?id=${encodeURIComponent(resumeId)}`);
      if (!res.ok || cancelled) return;
      const d = await res.json();
      if (cancelled) return;
      if (typeof d.rawText === "string") {
        setOriginalText(d.rawText);
        setTailoredText("");
        setMeta(null);
        setLastTailoredId(null);
        setDecisionMetrics(null);
        setImpactRunCompleted(false);
        setImpactParseWarning(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resumeId]);

  const selectedJob = useMemo(() => jobs.find((j) => j.id === jobId), [jobs, jobId]);
  const selectedResume = useMemo(() => resumes.find((r) => r.id === resumeId), [resumes, resumeId]);

  const originalSections = useMemo(() => parseResumeSections(originalText), [originalText]);

  const fetchEngineDecision = useCallback(
    async (tailoredIdOverride?: string | null) => {
      if (!resumeId || !jobId) return;
      setEngineLoading(true);
      setEngineError(null);
      try {
        const tid = tailoredIdOverride !== undefined ? tailoredIdOverride : lastTailoredId;
        const res = await fetch("/api/decision/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            resumeId,
            tailoredResumeId: tid ?? undefined,
            persist: false,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? res.statusText);
        setEngineDecision(data.decision as DecisionOutput);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Decision unavailable";
        setEngineError(msg);
        setEngineDecision(null);
        if (process.env.NODE_ENV === "development") {
          console.error("[HireLens] decision/evaluate failed", e);
        }
      } finally {
        setEngineLoading(false);
      }
    },
    [resumeId, jobId, lastTailoredId],
  );

  useEffect(() => {
    if (!resumeId || !jobId) {
      setEngineDecision(null);
      setEngineError(null);
      return;
    }
    fetchEngineDecision();
  }, [resumeId, jobId, lastTailoredId, impactRunCompleted, fetchEngineDecision]);

  const runTailor = useCallback(async () => {
    if (!resumeId || !jobId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/resume/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setLastTailoredId(data.tailored?.id ?? null);
      const m = data.meta as TailorMeta | undefined;
      if (m) {
        setMeta(m);
        setOriginalText(m.originalText);
        setTailoredText(m.tailoredText);
      }
      setAtsBefore(null);
      setAtsAfter(null);
      setImpactScore(null);
      setKeywordGain(null);
      setMissingKeywords([]);
      setDecisionMetrics(null);
      setImpactRunCompleted(false);
      setImpactParseWarning(null);
      const tid = (data.tailored?.id as string | undefined) ?? null;
      await fetchEngineDecision(tid);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tailor failed");
    } finally {
      setLoading(false);
    }
  }, [resumeId, jobId, fetchEngineDecision]);

  const runImpact = useCallback(async () => {
    if (!lastTailoredId) return;
    setLoading(true);
    setError(null);
    setImpactParseWarning(null);
    try {
      const res = await fetch("/api/impact/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tailoredResumeId: lastTailoredId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);

      const raw = data.impact?.metrics;
      const coerced = normalizeImpactMetrics(raw);
      const parsed = normalizedImpactMetricsSchema.safeParse(coerced);

      setAtsBefore(coerced.ats_score_before);
      setAtsAfter(coerced.ats_score_after);
      setImpactScore(coerced.impact_score);
      setKeywordGain(coerced.keyword_gain);
      setMissingKeywords(coerced.missing_critical_keywords);
      setDecisionMetrics(coerced);
      setImpactRunCompleted(true);

      if (!parsed.success) {
        setImpactParseWarning(
          "Impact metrics did not match the expected schema after normalization. Displayed values use the normalized payload; check the browser console in development.",
        );
        if (process.env.NODE_ENV === "development") {
          console.error("[HireLens] impact metrics Zod safeParse failed", parsed.error.flatten(), {
            raw,
            coerced,
          });
        }
      }
      await fetchEngineDecision(lastTailoredId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impact failed");
    } finally {
      setLoading(false);
    }
  }, [lastTailoredId, fetchEngineDecision]);

  const exportDoc = useCallback(() => {
    if (!tailoredText.trim()) return;
    const title = meta?.jobTitle ?? selectedJob?.title ?? "resume";
    const blob = new Blob([tailoredText], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hirelens-tailored-${title.replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [tailoredText, meta?.jobTitle, selectedJob?.title]);

  const showContextStrip =
    listsReady && (selectedJob != null || selectedResume != null);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      {showContextStrip && (
        <div
          className="mb-6 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm shadow-sm"
          aria-live="polite"
        >
          {selectedJob && (
            <p className="text-foreground">
              <span className="font-medium">{selectedJob.title}</span>
              {selectedJob.company ? (
                <span className="text-muted-foreground"> · {selectedJob.company}</span>
              ) : null}
            </p>
          )}
          {selectedResume && (
            <p
              className={cn(
                "text-muted-foreground",
                selectedJob && "mt-1",
              )}
            >
              <span className="text-[11px] font-medium uppercase tracking-wide text-label">Resume</span>{" "}
              <span className="text-foreground/90">{selectedResume.label}</span>
            </p>
          )}
        </div>
      )}

      {/* Selection */}
      <div className="mb-8 rounded-2xl border border-border p-6">
        <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px] flex-1">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-label">Resume</label>
          <select
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-3 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/25"
            value={resumeId}
            onChange={(e) => {
              const next = e.target.value;
              setResumeId(next);
              setTailoredText("");
              setMeta(null);
              setDecisionMetrics(null);
              setImpactRunCompleted(false);
              setImpactParseWarning(null);
              setEngineDecision(null);
              setEngineError(null);
              router.replace(`${pathname}${buildTailorSearch(next, jobId)}`, { scroll: false });
            }}
          >
            <option value="">Choose resume…</option>
            {resumes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
          {resumesLoadError && (
            <p className="mt-2 text-xs text-score-danger" role="alert">
              {resumesLoadError}
            </p>
          )}
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-label">Job</label>
          <select
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-3 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/25"
            value={jobId}
            onChange={(e) => {
              const next = e.target.value;
              setJobId(next);
              setLastTailoredId(null);
              setTailoredText("");
              setMeta(null);
              setDecisionMetrics(null);
              setImpactRunCompleted(false);
              setImpactParseWarning(null);
              setAtsBefore(null);
              setAtsAfter(null);
              setImpactScore(null);
              setKeywordGain(null);
              setMissingKeywords([]);
              setEngineDecision(null);
              setEngineError(null);
              router.replace(`${pathname}${buildTailorSearch(resumeId, next)}`, { scroll: false });
            }}
          >
            <option value="">Choose job…</option>
            {jobs.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
          {jobsLoadError && (
            <p className="mt-2 text-xs text-score-danger" role="alert">
              {jobsLoadError}
            </p>
          )}
        </div>
        <div className="flex min-w-[200px] flex-1 flex-col gap-2">
          {mockMode && (
            <p className="text-xs text-muted-foreground" role="status">
              Preview mode: Tailoring is limited in mock mode
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={loading || !resumeId || !jobId} onClick={runTailor}>
              {loading ? "Working…" : "Tailor resume"}
            </Button>
            <Button disabled={loading || !lastTailoredId} variant="outline" onClick={runImpact}>
              Evaluate impact
            </Button>
          </div>
        </div>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-score-danger">{error}</p>}

      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 mb-8 rounded-xl border border-border bg-surface/95 px-6 py-4 backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight text-foreground">
              {meta?.jobTitle ?? selectedJob?.title ?? "Select a job"}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{meta?.company ?? selectedJob?.company ?? "—"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div>
              <span className="text-label">ATS score</span>
              <span className="ml-2 font-medium tabular-nums text-foreground">
                {atsBefore != null && atsAfter != null ? (
                  <>
                    {atsBefore.toFixed(0)} → {atsAfter.toFixed(0)}
                  </>
                ) : (
                  <span className="text-muted-foreground">— → —</span>
                )}
              </span>
            </div>
            <div>
              <span className="text-label">Impact</span>
              <span className="ml-2 font-medium tabular-nums text-score-impact">
                {impactScore != null ? impactScore.toFixed(1) : "—"}
              </span>
            </div>
          </div>
          <Button variant="outline" className="shrink-0 gap-2" disabled={!tailoredText.trim()} onClick={exportDoc}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* 3 columns */}
      <div className="grid min-h-[560px] flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr_320px]">
        {/* Original */}
        <DocumentPanel title="Original resume" subtitle="Source document">
          {originalText ? (
            <div className="space-y-4">
              {originalSections.map((sec) => (
                <section key={sec.key} className="space-y-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-label">{sec.title}</h3>
                  <p className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-foreground/95">{sec.body}</p>
                </section>
              ))}
            </div>
          ) : (
            <EmptyDoc hint="Pick a resume and run Tailor to load content." />
          )}
        </DocumentPanel>

        {/* Tailored */}
        <DocumentPanel title="Tailored resume" subtitle="Edits highlighted subtly">
          {tailoredText ? (
            <TailoredDiffText original={originalText} tailored={tailoredText} />
          ) : (
            <EmptyDoc hint="Run Tailor to generate an aligned version with highlights." />
          )}
        </DocumentPanel>

        {/* Insights */}
        <aside className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Change log</h3>
            <ul className="mt-3 max-h-40 space-y-3 overflow-y-auto text-sm text-muted-foreground">
              {(meta?.changeLog ?? []).length ? (
                meta!.changeLog.map((c, i) => (
                  <li key={i} className="border-b border-border/60 pb-3 last:border-0">
                    <span className="font-medium text-foreground/90">{c.section}</span>
                    <p className="mt-1 leading-snug">{c.summary}</p>
                    {c.detail && <p className="mt-1 font-mono text-xs text-label">{c.detail}</p>}
                  </li>
                ))
              ) : (
                <li className="text-label">No changes yet.</li>
              )}
            </ul>
            {(meta?.warnings?.length ?? 0) > 0 && (
              <ul className="mt-2 text-xs text-score-warning">
                {meta!.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Keyword gain</h3>
            <p className="text-2xl font-semibold tabular-nums text-primary">
              {keywordGain != null ? `${keywordGain > 0 ? "+" : ""}${keywordGain.toFixed(1)} pp` : "—"}
            </p>
            <p className="text-xs text-label">Run Evaluate impact after tailoring.</p>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Missing keywords</h3>
            <div className="flex flex-wrap gap-2">
              {missingKeywords.length ? (
                missingKeywords.slice(0, 12).map((kw) => (
                  <span key={kw} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    {kw}
                  </span>
                ))
              ) : (
                <span className="text-sm text-label">—</span>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            {engineLoading && (
              <p className="mb-3 text-xs text-label" aria-live="polite">
                Updating decision engine…
              </p>
            )}
            {engineError && (
              <div
                className="mb-3 rounded-xl border border-score-warning/40 bg-score-warning/10 p-3 text-xs text-muted-foreground"
                role="status"
              >
                Decision engine: {engineError}
              </div>
            )}
            {engineDecision && <DecisionEngineCompact decision={engineDecision} />}
            <TailorDecisionSection
              lastTailoredId={lastTailoredId}
              impactRunCompleted={impactRunCompleted}
              metrics={decisionMetrics}
              impactParseWarning={impactParseWarning}
            />
          </div>

          <div className="mt-auto space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Controls</h3>
            <div className="grid grid-cols-1 gap-2">
              <ControlBtn
                icon={Lock}
                label="Lock section"
                onClick={() => setLocked((s) => ({ ...s, doc: !s.doc }))}
                active={locked.doc}
              />
              <ControlBtn icon={RefreshCw} label="Regenerate" disabled={!resumeId || !jobId || loading} onClick={runTailor} />
              <ControlBtn icon={Wand2} label="Shorten" disabled title="Coming soon" />
              <ControlBtn icon={Zap} label="Optimize" disabled title="Coming soon" />
            </div>
            <p className="text-xs text-label">Regenerate re-runs tailoring. Shorten / Optimize ship in a later release.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function DocumentPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[480px] flex-col rounded-2xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-label">{subtitle}</p>
      </div>
      <div className="custom-scrollbar flex-1 overflow-y-auto p-5">{children}</div>
    </div>
  );
}

function EmptyDoc({ hint }: { hint: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 py-16 text-center">
      <Sparkles className="mb-3 h-8 w-8 text-label/80" />
      <p className="max-w-xs text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function ControlBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border bg-background/50 text-foreground hover:border-border-hover hover:bg-muted/40",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      {label}
    </button>
  );
}
