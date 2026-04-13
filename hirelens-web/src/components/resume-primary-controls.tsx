"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function ResumePrimaryControls({
  resumeId,
  isPrimary,
}: {
  resumeId: string;
  isPrimary: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setPrimary() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/resume/primary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set primary");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {isPrimary ? (
        <span
          className={cn(
            "inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary",
          )}
        >
          Primary
        </span>
      ) : (
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void setPrimary()}>
          {loading ? "Saving…" : "Set as primary"}
        </Button>
      )}
      {error ? <span className="text-xs text-score-danger">{error}</span> : null}
    </div>
  );
}
