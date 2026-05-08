import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NormalizedImpactMetrics } from "@/lib/types/impact-metrics";
import { cn } from "@/lib/utils/cn";

function labelForApply(v: NormalizedImpactMetrics["apply_recommendation"]) {
  if (v === "yes") return "Apply — favorable signals";
  if (v === "no") return "Hold — weak fit or low lift";
  if (v === "maybe") return "Consider — mixed signals";
  return null;
}

function impactApplyShortLabel(v: NormalizedImpactMetrics["apply_recommendation"]): string {
  if (v === "yes") return "Favorable";
  if (v === "no") return "Cautious";
  return "Mixed";
}

export function hasDecisionSignal(metrics: NormalizedImpactMetrics | null): boolean {
  if (!metrics) return false;
  return (
    metrics.apply_recommendation != null ||
    metrics.confidence != null ||
    (metrics.notes?.length ?? 0) > 0
  );
}

export function DecisionRecommendationCard({
  metrics,
  title = "Decision signal",
}: {
  metrics: NormalizedImpactMetrics | null;
  title?: string;
}) {
  if (!metrics) return null;
  const hasSignal = hasDecisionSignal(metrics);

  if (!hasSignal) {
    return (
      <Card className="border-border bg-card/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Recommendation unavailable for this evaluation — apply/confidence notes were not produced. Try re-running
            impact after tailoring, or check the pipeline when using Flask.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.06]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {metrics.apply_recommendation != null && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-label">Impact model signal</p>
            <p className="mt-1 font-medium text-foreground">{labelForApply(metrics.apply_recommendation)}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              From the impact evaluator — related to, but not identical to, Apply / Consider / Skip on the job page.
            </p>
          </div>
        )}
        {metrics.confidence != null && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-label">Impact confidence</p>
            <p className="mt-1 capitalize text-foreground">{metrics.confidence}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Confidence from the impact payload — separate from recommendation certainty on the job detail card.
            </p>
          </div>
        )}
        {metrics.notes && metrics.notes.length > 0 && (
          <ul className="space-y-2 text-muted-foreground">
            {metrics.notes.slice(0, 4).map((n, i) => (
              <li key={i} className="border-l-2 border-primary/30 pl-3 leading-relaxed">
                {n}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Compact inline variant for the Tailoring Studio insights column. */
export function DecisionRecommendationInline({ metrics }: { metrics: NormalizedImpactMetrics | null }) {
  if (!metrics) return null;
  const hasSignal = hasDecisionSignal(metrics);
  if (!hasSignal) return null;

  return (
    <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/[0.06] p-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-label">Impact model</p>
      <div className="flex flex-wrap gap-3 text-xs">
        {metrics.apply_recommendation != null && (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 font-medium",
              metrics.apply_recommendation === "yes" && "bg-score-success/15 text-score-success",
              metrics.apply_recommendation === "maybe" && "bg-score-warning/15 text-score-warning",
              metrics.apply_recommendation === "no" && "bg-score-danger/15 text-score-danger",
            )}
            title="Impact evaluator output — compare to Apply / Consider / Skip on the job page."
          >
            Signal: {impactApplyShortLabel(metrics.apply_recommendation)}
          </span>
        )}
        {metrics.confidence != null && (
          <span
            className="rounded-full bg-muted px-2.5 py-1 capitalize text-muted-foreground"
            title="Impact payload confidence, not job-page recommendation certainty."
          >
            Impact confidence: {metrics.confidence}
          </span>
        )}
      </div>
      {metrics.notes && metrics.notes.length > 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">{metrics.notes[0]}</p>
      )}
    </div>
  );
}

/** Tailoring Studio: always shows a non-empty decision area with explicit states. */
export function TailorDecisionSection({
  lastTailoredId,
  impactRunCompleted,
  metrics,
  impactParseWarning,
}: {
  lastTailoredId: string | null;
  impactRunCompleted: boolean;
  metrics: NormalizedImpactMetrics | null;
  impactParseWarning: string | null;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Impact &amp; decision preview</h3>

      {impactParseWarning && (
        <div
          className="rounded-xl border border-score-warning/45 bg-score-warning/10 p-3 text-sm"
          role="status"
          aria-live="polite"
        >
          <p className="font-medium text-score-warning">Impact data validation warning</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{impactParseWarning}</p>
          <p className="mt-2 text-xs text-label">Numeric scores above may still reflect a normalized fallback.</p>
        </div>
      )}

      {!lastTailoredId && (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-sm leading-relaxed text-muted-foreground">
          Run <span className="font-medium text-foreground">Tailor resume</span>, then{" "}
          <span className="font-medium text-foreground">Evaluate impact</span> to load tailored-impact signals and impact
          confidence for this pair.
        </p>
      )}

      {lastTailoredId && !impactRunCompleted && (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-sm leading-relaxed text-muted-foreground">
          Run <span className="font-medium text-foreground">Evaluate impact</span> to load impact metrics and the
          decision preview for this tailored version.
        </p>
      )}

      {lastTailoredId && impactRunCompleted && metrics && !hasDecisionSignal(metrics) && impactParseWarning && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          No recommendation or confidence fields were present in the normalized payload.
        </p>
      )}

      {lastTailoredId && impactRunCompleted && metrics && !hasDecisionSignal(metrics) && !impactParseWarning && (
        <p className="rounded-xl border border-border bg-muted/15 p-3 text-sm leading-relaxed text-muted-foreground">
          Impact recommendation unavailable — this evaluation did not produce apply/confidence fields. Re-run impact
          after tailoring or use Flask for full metrics.
        </p>
      )}

      {lastTailoredId && impactRunCompleted && metrics && hasDecisionSignal(metrics) && (
        <DecisionRecommendationInline metrics={metrics} />
      )}
    </div>
  );
}

/** Job detail: when no impact record exists for this job yet. */
export function JobImpactDecisionPlaceholder() {
  return (
    <Card className="border-border bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tailoring impact</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-muted-foreground">
          No tailored impact evaluation stored for this job yet. Open{" "}
          <span className="font-medium text-foreground">Tailor</span>, generate a tailored resume for this role, then run{" "}
          <span className="font-medium text-foreground">Evaluate impact</span> to attach impact metrics to this pair.
        </p>
      </CardContent>
    </Card>
  );
}
