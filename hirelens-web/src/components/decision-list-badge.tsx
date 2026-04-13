import { quickApplyGuidanceFromMatch } from "@/lib/services/decision-service";
import { cn } from "@/lib/utils/cn";

/** Apply / Consider / Skip hint for a job list row (uses latest match score + verdict). */
export function DecisionListBadge({ matchScore, verdict }: { matchScore: number; verdict: string }) {
  const { label, tone } = quickApplyGuidanceFromMatch(matchScore, verdict);
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
