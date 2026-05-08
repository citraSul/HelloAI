import Link from "next/link";
import type { IngestOperationalTrustSnapshot } from "@/lib/services/ingest-operational-log";

function formatShort(dt: Date | null | undefined): string {
  if (!dt) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(dt);
}

function sourceErrorCount(raw: unknown): number {
  return Array.isArray(raw) ? raw.length : 0;
}

/**
 * Read-only feed sync freshness from `getIngestOperationalTrustSnapshot` — no secrets.
 */
export function JobsFeedFreshnessStrip({ snapshot }: { snapshot: IngestOperationalTrustSnapshot }) {
  if (!snapshot.available) {
    return (
      <div className="mb-4 rounded-xl border border-border/50 bg-muted/[0.07] px-3.5 py-2.5 text-[11px] leading-snug text-muted-foreground/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <span className="text-label">Feed sync:</span> Status unavailable ({snapshot.reason}).{" "}
        <Link href="/diagnostics" className="font-medium text-primary/90 underline-offset-4 hover:underline">
          Diagnostics
        </Link>
      </div>
    );
  }

  if (!snapshot.lastRun) {
    return (
      <div className="mb-4 rounded-xl border border-border/50 bg-muted/[0.07] px-3.5 py-2.5 text-[11px] leading-snug text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <span className="text-label">Feed sync:</span> No feed sync recorded yet. Ingest runs when{" "}
        <span className="font-mono text-[10px] text-foreground/80">POST /api/jobs/ingest</span> succeeds with cron auth.{" "}
        <Link href="/diagnostics" className="font-medium text-primary/90 underline-offset-4 hover:underline">
          Details
        </Link>
      </div>
    );
  }

  const last = snapshot.lastRun;
  const srcErr = last.success ? sourceErrorCount(last.sourceErrors) : 0;
  const upsertLine = last.success ? (
    <span>
      {" "}
      · Last run upserts: <span className="font-medium text-foreground/90">{last.succeeded}</span> ok
      {last.failed > 0 ? (
        <>
          , <span className="text-score-warning">{last.failed}</span> failed
        </>
      ) : null}
    </span>
  ) : null;

  return (
    <div className="mb-4 rounded-xl border border-border/50 bg-muted/[0.07] px-3.5 py-2.5 text-[11px] leading-relaxed text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <p>
        <span className="text-label">Feed sync:</span> Last attempt{" "}
        <span className="font-medium text-foreground/85">{formatShort(last.createdAt)}</span>
        {last.success ? (
          <span className="text-score-success"> · completed</span>
        ) : (
          <span className="text-score-danger"> · failed</span>
        )}
        {upsertLine}
        {srcErr > 0 ? (
          <span className="text-score-warning"> · {srcErr} feed source error{srcErr === 1 ? "" : "s"}</span>
        ) : null}
      </p>
      <p className="mt-0.5">
        Last success:{" "}
        {snapshot.lastSuccess ? (
          <span className="font-medium text-foreground/85">{formatShort(snapshot.lastSuccess.createdAt)}</span>
        ) : (
          <span>—</span>
        )}
        {!last.success && last.errorMessage ? (
          <span className="block truncate text-score-danger/90" title={last.errorMessage}>
            {last.errorMessage.length > 120 ? `${last.errorMessage.slice(0, 117)}…` : last.errorMessage}
          </span>
        ) : null}
      </p>
      <p className="mt-1">
        <Link href="/diagnostics" className="font-medium text-primary/90 underline-offset-4 hover:underline">
          Full operational status
        </Link>
      </p>
    </div>
  );
}
