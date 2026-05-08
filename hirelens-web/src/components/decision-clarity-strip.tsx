import { cn } from "@/lib/utils/cn";
import { DECISION_TRIAD_INLINE } from "@/lib/decision-ui-labels";

type StripPlacement = "jobs" | "jobDetail";

const COPY: Record<StripPlacement, string> = {
  jobs: `Match % estimates fit to the posting. ${DECISION_TRIAD_INLINE} is the action triad for each row. Recommendation certainty (on the job page) measures evidence for that triad — not the same as match %.`,
  jobDetail: `Match signal is fit strength. ${DECISION_TRIAD_INLINE} is what to do next. Recommendation certainty is how strong the evidence is for that triad — separate from match %. Tailor + Evaluate impact can deepen the recommendation when impact data exists.`,
};

/**
 * Lightweight glossary line — same grid width as PageHeader; no layout refactor.
 */
export function DecisionClarityStrip({
  placement,
  className,
}: {
  placement: StripPlacement;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "mb-6 max-w-3xl rounded-r-xl border-y border-r border-border/45 border-l-2 border-l-primary/45 bg-muted/[0.06] py-3 pl-4 pr-3 text-[11px] leading-relaxed text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        className,
      )}
      aria-label="How HireLens decision signals relate"
    >
      <p>
        <span className="font-medium text-foreground/90">How signals connect: </span>
        {COPY[placement]}
      </p>
    </aside>
  );
}
