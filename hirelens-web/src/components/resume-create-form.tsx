"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ResumeCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/resume/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), rawText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.details?.fieldErrors ?? res.statusText);
      setSuccess(true);
      setTitle("");
      setRawText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card">
      <h2 className="text-sm font-semibold text-foreground">Add resume</h2>
      <p className="text-xs text-muted-foreground">Paste plain text (minimum length enforced). File upload can come later.</p>
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-label">Title</label>
        <input
          required
          className="w-full rounded-xl border border-border bg-background/50 py-2.5 pl-3 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/25"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Principal Engineer — 2025"
          maxLength={200}
        />
      </div>
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-label">Resume text</label>
        <textarea
          required
          className="custom-scrollbar min-h-[200px] w-full rounded-xl border border-border bg-background/50 p-3 font-mono text-sm leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-primary/25"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste your full resume text…"
        />
      </div>
      {error && <p className="text-sm text-score-danger">{error}</p>}
      {success && <p className="text-sm text-score-success">Resume saved.</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save resume"}
      </Button>
    </form>
  );
}
