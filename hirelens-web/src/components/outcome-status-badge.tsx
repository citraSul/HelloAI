import { cn } from "@/lib/utils/cn";
import type { outcomeStatusValues } from "@/lib/validators/outcome";

type OutcomeStatus = (typeof outcomeStatusValues)[number];

const LABEL: Record<OutcomeStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  responded: "Responded",
  interviewed: "Interview",
  offered: "Offer",
  rejected: "Rejected",
  skipped: "Skipped",
  archived: "Archived",
};

export function OutcomeStatusBadge({ status }: { status: OutcomeStatus }) {
  const tone =
    status === "offered"
      ? "border-score-success/50 bg-score-success/15 text-score-success"
      : status === "rejected"
        ? "border-score-danger/50 bg-score-danger/10 text-score-danger"
        : status === "skipped"
          ? "border-border bg-muted/40 text-muted-foreground"
          : status === "interviewed" || status === "responded"
            ? "border-primary/40 bg-primary/10 text-primary"
            : status === "applied"
              ? "border-border bg-muted/50 text-foreground"
              : "border-border bg-muted/30 text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        tone,
      )}
    >
      {LABEL[status]}
    </span>
  );
}
