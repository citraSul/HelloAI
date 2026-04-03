"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OutcomeStatusBadge } from "@/components/outcome-status-badge";
import type { ApplicationOutcomeDTO } from "@/lib/types/application-outcome";
import type { outcomeStatusValues } from "@/lib/validators/outcome";

type Status = (typeof outcomeStatusValues)[number];

const QUICK: { label: string; status: Exclude<Status, "saved" | "archived"> }[] = [
  { label: "Mark applied", status: "applied" },
  { label: "Mark response", status: "responded" },
  { label: "Mark interview", status: "interviewed" },
  { label: "Mark offer", status: "offered" },
  { label: "Mark rejected", status: "rejected" },
];

export function ApplicationOutcomePanel({
  jobId,
  resumeId,
  resumeTitle,
  initial,
}: {
  jobId: string;
  resumeId: string;
  resumeTitle: string;
  initial: ApplicationOutcomeDTO | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<ApplicationOutcomeDTO | null>(initial);

  async function updateStatus(status: Status) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/outcomes/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, resumeId, status }),
        });
        const data = (await res.json()) as { outcome?: ApplicationOutcomeDTO; error?: string };
        if (!res.ok) {
          setError(data.error ?? "Update failed");
          return;
        }
        if (data.outcome) setLocal(data.outcome);
        router.refresh();
      } catch {
        setError("Network error");
      }
    });
  }

  const lastUpdate = local?.updatedAt
    ? new Date(local.updatedAt).toLocaleString()
    : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Application outcome</CardTitle>
        <p className="text-xs font-normal text-muted-foreground">
          Tracking outcome for: <span className="font-medium text-foreground">{resumeTitle}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!local || local.status === "saved" ? (
          <p className="text-sm text-muted-foreground">No outcome recorded yet — use the actions below when you move forward with this application.</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-label">Status</span>
          <OutcomeStatusBadge status={local?.status ?? "saved"} />
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">Updated {lastUpdate}</span>
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-score-danger/40 bg-score-danger/10 px-3 py-2 text-xs text-score-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <Button
              key={q.status}
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => updateStatus(q.status)}
            >
              {q.label}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => updateStatus("archived")}
          >
            Archive
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
