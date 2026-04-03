import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DecisionOutput } from "@/lib/types/decision";
import { cn } from "@/lib/utils/cn";

function recStyles(rec: DecisionOutput["recommendation"]) {
  switch (rec) {
    case "apply":
      return "bg-score-success/15 text-score-success border-score-success/30";
    case "skip":
      return "bg-score-danger/15 text-score-danger border-score-danger/30";
    default:
      return "bg-score-warning/15 text-score-warning border-score-warning/30";
  }
}

function confStyles(c: DecisionOutput["confidence"]) {
  switch (c) {
    case "high":
      return "text-score-success";
    case "low":
      return "text-score-danger";
    default:
      return "text-score-warning";
  }
}

function confMeaning(c: DecisionOutput["confidence"]) {
  if (c === "high") return "Strong evidence this resume is competitive for this role.";
  if (c === "medium") return "Worth considering, with meaningful caveats to review.";
  return "Current evidence is weak; proceed only with strong strategic reasons.";
}

export function DecisionSummaryCard({
  decision,
  title = "Application decision",
  resumeTitle,
}: {
  decision: DecisionOutput;
  title?: string;
  /** When set, decision is for this resume vs the job. */
  resumeTitle?: string | null;
}) {
  const provNote =
    decision.provenance === "none"
      ? resumeTitle
        ? "Run Score match to produce a fit score for the selected resume."
        : "Create a resume in the library, then run Score match to tie apply / maybe / skip guidance to that profile."
      : decision.provenance === "match_only"
        ? "apply / maybe / skip from match scoring only — tailored impact not evaluated yet for this pair."
        : "apply / maybe / skip using match plus tailored impact for this resume and job.";

  return (
    <Card className="border-primary/25 bg-gradient-to-b from-primary/[0.07] to-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {resumeTitle ? (
          <p className="text-xs font-medium leading-relaxed text-foreground/95">
            Based on resume: <span className="text-foreground">{resumeTitle}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Create a resume in the library to tie apply / maybe / skip guidance to a specific profile.
          </p>
        )}
        <p className="text-xs font-normal leading-relaxed text-muted-foreground">{provNote}</p>
        {decision.provenance === "match_and_impact" && (
          <p className="text-xs text-muted-foreground">Enhanced using tailored impact analysis.</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
              recStyles(decision.recommendation),
            )}
          >
            {decision.recommendation}
          </span>
          <span className={cn("text-sm font-medium capitalize", confStyles(decision.confidence))}>
            {decision.confidence} confidence
          </span>
          {decision.decision_score != null && (
            <span className="tabular-nums text-sm text-label">Score {Math.round(decision.decision_score)}</span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-foreground/95">{decision.summary}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{confMeaning(decision.confidence)}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-label">Top reasons</p>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {decision.reasons.slice(0, 2).map((r, i) => (
                <li key={i} className="border-l-2 border-primary/35 pl-3 leading-snug">
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-label">Top risks</p>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {(decision.risks.length > 0 ? decision.risks : ["No major risks flagged by the current rules."])
                .slice(0, 2)
                .map((r, i) => (
                  <li key={i} className="border-l-2 border-score-warning/35 pl-3 leading-snug">
                    {r}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Compact block for Tailoring Studio (under decision signal). */
export function DecisionEngineCompact({ decision }: { decision: DecisionOutput }) {
  return (
    <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-label">Decision engine</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase", recStyles(decision.recommendation))}>
          {decision.recommendation}
        </span>
        <span className={cn("text-xs font-medium capitalize", confStyles(decision.confidence))}>{decision.confidence}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{decision.summary}</p>
      <div className="mt-3 grid gap-2 text-xs text-label sm:grid-cols-2">
        <div>
          <span className="text-label">Why: </span>
          {decision.reasons[0]?.slice(0, 140)}
          {decision.reasons[0] && decision.reasons[0].length > 140 ? "…" : ""}
        </div>
        <div>
          <span className="text-label">Risk: </span>
          {(decision.risks[0] ?? "—").slice(0, 140)}
        </div>
      </div>
    </div>
  );
}
