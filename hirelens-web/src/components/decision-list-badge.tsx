import { cn } from "@/lib/utils/cn";

export type DecisionListTone = "success" | "warning" | "danger";

/** Apply / Consider / Skip for a job list row (label computed server-side for list/detail alignment). */
export function DecisionListBadge({
  label,
  tone,
}: {
  label: "Apply" | "Consider" | "Skip";
  tone: DecisionListTone;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        tone === "success" && "bg-score-success/15 text-score-success ring-1 ring-score-success/20",
        tone === "warning" && "bg-score-warning/15 text-score-warning ring-1 ring-score-warning/20",
        tone === "danger" && "bg-score-danger/15 text-score-danger ring-1 ring-score-danger/20",
      )}
    >
      {label}
    </span>
  );
}
