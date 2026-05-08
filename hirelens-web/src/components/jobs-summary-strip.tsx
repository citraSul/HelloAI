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
        "rounded-xl border border-border/50 bg-muted/[0.08] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        accent === "success" && "border-score-success/30 bg-score-success/[0.07]",
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 tabular-nums text-lg font-semibold tracking-tight text-foreground/95">{value}</p>
      <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground/85">{hint}</p>
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
    <div className={cn("mb-8 border-b border-border/50 pb-6", className)}>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
        <StatCell label="Total jobs" value={summary.total} hint="Shown in list (max 50)" />
        <StatCell
          label="Apply-worthy"
          value={summary.applyWorthy}
          hint="Rows whose hint is Apply (saved decision or match)"
          accent="success"
        />
        <StatCell label="Applied" value={summary.applied} hint="Tracked: applied" />
        <StatCell label="Skipped" value={summary.skipped} hint="Tracked: skipped" />
        <StatCell label="In pipeline" value={summary.inPipeline} hint="Past first steps" />
      </div>
      <p className="mt-2.5 text-[10px] leading-relaxed text-muted-foreground/75">
        Apply-worthy counts rows whose decision hint is Apply — same rule as badges (saved decision when still current,
        otherwise match). Uses your feed resume (primary or default). Tracking counts outcomes for that same resume per
        job.
      </p>
    </div>
  );
}
