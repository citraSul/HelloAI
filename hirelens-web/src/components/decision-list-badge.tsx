import { quickDecisionLabelFromMatch } from "@/lib/services/decision-service";
import { cn } from "@/lib/utils/cn";

export function DecisionListBadge({ matchScore }: { matchScore: number }) {
  const { label, tone } = quickDecisionLabelFromMatch(matchScore);
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "success" && "bg-score-success/15 text-score-success",
        tone === "warning" && "bg-score-warning/15 text-score-warning",
        tone === "danger" && "bg-score-danger/15 text-score-danger",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}
