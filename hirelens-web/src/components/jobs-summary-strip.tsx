import { cn } from "@/lib/utils/cn";
import type { JobsListSummary } from "@/lib/jobs-list-summary";

function StatCell({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint: string;
  accent?: "default" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card/50 px-3 py-2.5 shadow-sm",
        accent === "success" && "border-score-success/35 bg-score-success/5",
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-label">{label}</p>
      <p className="mt-0.5 tabular-nums text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}

export function JobsSummaryStrip({
  summary,
  className,
}: {
  summary: JobsListSummary;
  /** e.g. `mb-0` when embedded in another card */
  className?: string;
}) {
  return (
    <div className={cn("mb-5", className)}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatCell label="Total jobs" value={summary.total} hint="Shown in list (max 50)" />
        <StatCell
          label="Apply-worthy"
          value={summary.applyWorthy}
          hint="Apply on list (saved decision or match)"
          accent="success"
        />
        <StatCell label="Applied" value={summary.applied} hint="Tracked: applied" />
        <StatCell label="Skipped" value={summary.skipped} hint="Tracked: skipped" />
        <StatCell label="In pipeline" value={summary.inPipeline} hint="Past first steps" />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Apply-worthy uses the same Apply / Consider / Skip rule as job rows (saved decision when still current,
        otherwise match). Same feed resume as the Jobs page. Tracking uses that resume per job.
      </p>
    </div>
  );
}
