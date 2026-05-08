import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DECISION_TRIAD_READABLE, recommendationDisplayLabel } from "@/lib/decision-ui-labels";
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

function certaintyIntro(provenance: DecisionOutput["provenance"]) {
  if (provenance === "none") {
    return "Provisional until you run Score match for this job and resume.";
  }
  if (provenance === "match_only") {
    return "Certainty draws on match rules only; tailored impact is not in this evaluation yet.";
  }
  return "Certainty uses match plus tailored impact for this resume and job.";
}

export function DecisionSummaryCard({
  decision,
  title = "Action recommendation",
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
        ? "Run Score match to produce a match % for the selected resume."
        : `Create a resume in the library, then run Score match to tie ${DECISION_TRIAD_READABLE} guidance to that profile.`
      : decision.provenance === "match_only"
        ? `${DECISION_TRIAD_READABLE} from match scoring only — tailored impact not evaluated yet for this pair.`
        : `${DECISION_TRIAD_READABLE} using match plus tailored impact for this resume and job.`;

  return (
    <Card className="border-primary/35 bg-gradient-to-b from-primary/[0.1] via-card to-card shadow-brand-soft ring-primary/15">
      <CardHeader className="space-y-2.5 pb-3">
        <CardTitle className="text-lg tracking-[-0.02em]">{title}</CardTitle>
        {resumeTitle ? (
          <p className="text-xs font-medium leading-relaxed text-foreground/95">
            Based on resume: <span className="text-foreground">{resumeTitle}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Create a resume in the library to tie {DECISION_TRIAD_READABLE} guidance to a specific profile.
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
              "rounded-full border px-3 py-1 text-sm font-semibold tracking-tight",
              recStyles(decision.recommendation),
            )}
          >
            {recommendationDisplayLabel(decision.recommendation)}
          </span>
        </div>
        <div
          className={cn(
            "space-y-1.5 rounded-xl border px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
            decision.confidence === "low"
              ? "border-score-warning/35 bg-score-warning/[0.06]"
              : "border-border/55 bg-muted/[0.12]",
          )}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-label">Recommendation certainty</p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            How strong the evidence is for {DECISION_TRIAD_READABLE.toLowerCase()} — not your headline match %.
          </p>
          <p className="text-sm leading-snug text-foreground/95">
            <span className={cn("font-semibold capitalize", confStyles(decision.confidence))}>
              {decision.confidence}
            </span>
            <span className="text-muted-foreground"> — {confMeaning(decision.confidence)}</span>
          </p>
          <p className="text-[11px] leading-snug text-muted-foreground">{certaintyIntro(decision.provenance)}</p>
        </div>
        {decision.decision_score != null && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground/90">Engine blend</span>{" "}
            <span className="tabular-nums text-foreground/90">{Math.round(decision.decision_score)}</span>
            <span>
              {" "}
              — internal blend score for this recommendation; not the headline match % under Match signal.
            </span>
          </p>
        )}
        <p className="text-[15px] leading-relaxed text-foreground/95">{decision.summary}</p>
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
    <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-xs font-medium uppercase tracking-wide text-label">Decision preview (studio)</p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        Live read while you work — job detail may differ until you score there again after tailoring.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-tight",
            recStyles(decision.recommendation),
          )}
        >
          {recommendationDisplayLabel(decision.recommendation)}
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
