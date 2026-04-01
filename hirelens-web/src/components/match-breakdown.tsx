import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Breakdown = Record<string, number>;

function splitStrengthsGaps(breakdown: Breakdown | null | undefined) {
  if (!breakdown || typeof breakdown !== "object") {
    return {
      strengths: [] as { key: string; value: number }[],
      gaps: [] as { key: string; value: number }[],
    };
  }
  const entries = Object.entries(breakdown).filter(([, v]) => typeof v === "number");
  const strengths = entries.filter(([, v]) => v >= 0.65).sort((a, b) => b[1] - a[1]);
  const gaps = entries.filter(([, v]) => v < 0.65).sort((a, b) => a[1] - b[1]);
  return {
    strengths: strengths.map(([key, value]) => ({ key, value })),
    gaps: gaps.map(([key, value]) => ({ key, value })),
  };
}

export function MatchBreakdownPanels({ breakdown }: { breakdown: unknown }) {
  const b = breakdown as Breakdown | null;
  const { strengths, gaps } = splitStrengthsGaps(b);

  if (strengths.length === 0 && gaps.length === 0) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Strengths</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Run a match to see dimension scores.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gaps</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Gaps appear when breakdown data is available.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-score-success">Strengths</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {strengths.length === 0 ? (
            <p className="text-sm text-muted-foreground">No strong dimensions yet.</p>
          ) : (
            strengths.map(({ key, value }) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/30 px-4 py-3"
              >
                <span className="text-sm capitalize text-foreground">{key}</span>
                <span className="tabular-nums text-sm font-medium text-score-success">{Math.round(value * 100)}%</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-score-warning">Gaps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {gaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No critical gaps flagged.</p>
          ) : (
            gaps.map(({ key, value }) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/30 px-4 py-3"
              >
                <span className="text-sm capitalize text-foreground">{key}</span>
                <span className="tabular-nums text-sm font-medium text-score-warning">{Math.round(value * 100)}%</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
