import type { DecisionConfidence } from "@/lib/types/decision";
import { cn } from "@/lib/utils/cn";

export type DecisionListTone = "success" | "warning" | "danger";

export type DecisionListTrust = {
  confidence: DecisionConfidence;
  /** Impact-only path: no match analysis on this row (see `listApplyGuidanceFromDecisionOrMatch`). */
  inferredWithoutMatch: boolean;
};

function trustCaption(trust: DecisionListTrust): { text: string; className: string } {
  if (trust.inferredWithoutMatch) {
    return {
      text: "Tailored signals only — no match score on this row yet.",
      className: "max-w-[220px] text-[10px] font-medium leading-snug text-score-warning",
    };
  }
  if (trust.confidence === "low") {
    return {
      text: "Weaker evidence — verify on the job page.",
      className: "max-w-[220px] text-[10px] leading-snug text-score-warning",
    };
  }
  if (trust.confidence === "medium") {
    return {
      text: "Moderate evidence for this decision hint.",
      className: "max-w-[220px] text-[10px] leading-snug text-muted-foreground",
    };
  }
  return {
    text: "Stronger evidence for this decision hint.",
    className: "max-w-[220px] text-[10px] leading-snug text-muted-foreground/90",
  };
}

/** Apply / Consider / Skip for a job list row (label computed server-side for list/detail alignment). */
export function DecisionListBadge({
  label,
  tone,
  trust,
}: {
  label: "Apply" | "Consider" | "Skip";
  tone: DecisionListTone;
  trust?: DecisionListTrust | null;
}) {
  const cap = trust ? trustCaption(trust) : null;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded-full px-3.5 py-1.5 text-sm font-semibold leading-none tracking-tight shadow-sm",
          tone === "success" &&
            "bg-score-success/18 text-score-success ring-2 ring-score-success/25 ring-offset-1 ring-offset-background",
          tone === "warning" &&
            "bg-score-warning/18 text-score-warning ring-2 ring-score-warning/25 ring-offset-1 ring-offset-background",
          tone === "danger" &&
            "bg-score-danger/18 text-score-danger ring-2 ring-score-danger/25 ring-offset-1 ring-offset-background",
        )}
      >
        {label}
      </span>
      {cap ? <span className={cap.className}>{cap.text}</span> : null}
    </span>
  );
}
