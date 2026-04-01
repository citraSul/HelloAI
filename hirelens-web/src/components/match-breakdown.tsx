import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const EXCLUDE_DIM = new Set(["strengths", "gaps", "reasoning", "missing_keywords"]);

type DimEntry = { key: string; value: number };

function splitDimensionScores(breakdown: Record<string, unknown> | null | undefined): {
  strengths: DimEntry[];
  gaps: DimEntry[];
} {
  if (!breakdown || typeof breakdown !== "object") {
    return { strengths: [], gaps: [] };
  }
  const entries = Object.entries(breakdown).filter(
    ([k, v]) => !EXCLUDE_DIM.has(k) && typeof v === "number",
  ) as [string, number][];
  const strengths = entries.filter(([, v]) => v >= 0.65).sort((a, b) => b[1] - a[1]);
  const gaps = entries.filter(([, v]) => v < 0.65).sort((a, b) => a[1] - b[1]);
  return {
    strengths: strengths.map(([key, value]) => ({ key, value })),
    gaps: gaps.map(([key, value]) => ({ key, value })),
  };
}

function narrativeFromBreakdown(breakdown: unknown): {
  reasoning: string | null;
  strengthLines: string[];
  gapLines: string[];
  missingKeywords: string[];
} {
  if (!breakdown || typeof breakdown !== "object") {
    return { reasoning: null, strengthLines: [], gapLines: [], missingKeywords: [] };
  }
  const b = breakdown as Record<string, unknown>;
  const reasoning = typeof b.reasoning === "string" ? b.reasoning : null;
  const strengthLines = Array.isArray(b.strengths)
    ? b.strengths.map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
    : [];
  const gapLines = Array.isArray(b.gaps)
    ? b.gaps.map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
    : [];
  const missingKeywords = Array.isArray(b.missing_keywords)
    ? b.missing_keywords.map(String)
    : [];
  return { reasoning, strengthLines, gapLines, missingKeywords };
}

export function MatchBreakdownPanels({ breakdown }: { breakdown: unknown }) {
  const b = breakdown as Record<string, unknown> | null;
  const { strengths, gaps } = splitDimensionScores(b);
  const narrative = narrativeFromBreakdown(breakdown);
  const hasNumeric = strengths.length > 0 || gaps.length > 0;
  const hasNarrative =
    narrative.strengthLines.length > 0 ||
    narrative.gapLines.length > 0 ||
    narrative.reasoning != null ||
    narrative.missingKeywords.length > 0;

  if (!hasNumeric && !hasNarrative) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Strengths</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Run a match to see dimension scores or narrative signals.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gaps</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Gaps appear when the scorer returns dimensions or lists.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {narrative.reasoning && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reasoning</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{narrative.reasoning}</p>
          </CardContent>
        </Card>
      )}

      {narrative.missingKeywords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Missing keywords</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {narrative.missingKeywords.slice(0, 24).map((kw) => (
                <span key={kw} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  {kw}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-score-success">Strengths</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasNumeric &&
              strengths.map(({ key, value }) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/30 px-4 py-3"
                >
                  <span className="text-sm capitalize text-foreground">{key}</span>
                  <span className="tabular-nums text-sm font-medium text-score-success">{Math.round(value * 100)}%</span>
                </div>
              ))}
            {narrative.strengthLines.map((line, i) => (
              <p key={`ns-${i}`} className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm text-foreground">
                {line}
              </p>
            ))}
            {!hasNumeric && narrative.strengthLines.length === 0 && (
              <p className="text-sm text-muted-foreground">No strengths listed yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-score-warning">Gaps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasNumeric &&
              gaps.map(({ key, value }) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/30 px-4 py-3"
                >
                  <span className="text-sm capitalize text-foreground">{key}</span>
                  <span className="tabular-nums text-sm font-medium text-score-warning">{Math.round(value * 100)}%</span>
                </div>
              ))}
            {narrative.gapLines.map((line, i) => (
              <p key={`ng-${i}`} className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm text-foreground">
                {line}
              </p>
            ))}
            {!hasNumeric && narrative.gapLines.length === 0 && (
              <p className="text-sm text-muted-foreground">No gaps listed yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
