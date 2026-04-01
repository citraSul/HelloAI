"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function JobCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [rawDescription, setRawDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/jobs/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          company: company.trim() || undefined,
          rawDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setSuccess(true);
      setTitle("");
      setCompany("");
      setRawDescription("");
      router.refresh();
      if (data.job?.id) {
        router.push(`/jobs/${data.job.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create job");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card">
      <h2 className="text-sm font-semibold text-foreground">Add job</h2>
      <p className="text-xs text-muted-foreground">Paste a job description (20+ characters). Analysis uses the mock agent unless the pipeline is enabled elsewhere.</p>
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-label">Title</label>
        <input
          required
          className="w-full rounded-xl border border-border bg-background/50 py-2.5 pl-3 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/25"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Role title"
          maxLength={200}
        />
      </div>
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-label">Company</label>
        <input
          className="w-full rounded-xl border border-border bg-background/50 py-2.5 pl-3 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/25"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Optional"
          maxLength={200}
        />
      </div>
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-label">Job description</label>
        <textarea
          required
          className="custom-scrollbar min-h-[180px] w-full rounded-xl border border-border bg-background/50 p-3 font-mono text-sm leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-primary/25"
          value={rawDescription}
          onChange={(e) => setRawDescription(e.target.value)}
          placeholder="Paste the full posting…"
        />
      </div>
      {error && <p className="text-sm text-score-danger">{error}</p>}
      {success && <p className="text-sm text-score-success">Job created. Redirecting…</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save job"}
      </Button>
    </form>
  );
}
