"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Opt = { id: string; label: string };

const selectClass =
  "w-full rounded-xl border border-border bg-card py-2.5 pl-3 pr-3 text-sm text-foreground outline-none transition-all duration-200 focus:border-border-hover focus:ring-2 focus:ring-primary/25";

export function TailorStudio() {
  const [resumes, setResumes] = useState<Opt[]>([]);
  const [jobs, setJobs] = useState<Opt[]>([]);
  const [resumeId, setResumeId] = useState("");
  const [jobId, setJobId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [lastTailoredId, setLastTailoredId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [r, j] = await Promise.all([fetch("/api/data/resumes"), fetch("/api/data/jobs")]);
        if (r.ok) {
          const d = await r.json();
          setResumes(d.items ?? []);
        }
        if (j.ok) {
          const d = await j.json();
          setJobs(d.items ?? []);
        }
      } catch {
        setError("Could not load lists (is the database running?)");
      }
    }
    load();
  }, []);

  async function run(path: string, body: object) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setResult(JSON.stringify(data, null, 2));
      if (data.tailored?.id) setLastTailoredId(data.tailored.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const payload = { resumeId, jobId };

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
      <Card className="border-border/90">
        <CardHeader>
          <CardTitle>Controls</CardTitle>
          <p className="text-sm text-muted-foreground">Choose a resume and job, then run actions.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-label">Resume</label>
            <select className={selectClass} value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
              <option value="">Choose…</option>
              {resumes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-label">Job</label>
            <select className={selectClass} value={jobId} onChange={(e) => setJobId(e.target.value)}>
              <option value="">Choose…</option>
              {jobs.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button disabled={loading || !resumeId || !jobId} onClick={() => run("/api/match/score", payload)}>
              Score match
            </Button>
            <Button
              disabled={loading || !resumeId || !jobId}
              variant="outline"
              onClick={() => run("/api/resume/tailor", payload)}
            >
              Tailor resume
            </Button>
            <Button
              disabled={loading || !lastTailoredId}
              variant="ghost"
              onClick={() => lastTailoredId && run("/api/impact/evaluate", { tailoredResumeId: lastTailoredId })}
            >
              Evaluate impact
            </Button>
          </div>
          {error && <p className="text-sm text-score-danger">{error}</p>}
        </CardContent>
      </Card>

      <Card className="border-border/90 bg-surface/30">
        <CardHeader>
          <CardTitle>Output</CardTitle>
          <p className="text-sm text-muted-foreground">Structured JSON from HireLens APIs.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Working…</p>
          ) : result ? (
            <pre className="max-h-[min(520px,70vh)] overflow-auto rounded-xl border border-border bg-card p-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {result}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">Results appear here after you run an action.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
