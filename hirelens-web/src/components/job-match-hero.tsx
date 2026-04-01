import { Card, CardContent } from "@/components/ui/card";
import { ScoreBadge } from "@/components/score-badge";

export function JobMatchHero({
  company,
  matchScore,
  verdict,
}: {
  company: string | null;
  matchScore: number;
  verdict: string;
}) {
  const pct = Math.round(matchScore * 100);

  return (
    <Card className="overflow-hidden border-border bg-gradient-to-br from-card via-card to-surface/40 shadow-brand-soft">
      <CardContent className="p-6 md:p-8">
        <p className="text-xs font-medium uppercase tracking-wider text-label">Match signal</p>
        <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{company ?? "Role"}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your strongest alignment vs this posting — use gaps to guide tailoring.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold tabular-nums tracking-tight text-foreground md:text-6xl">{pct}</span>
              <span className="text-lg font-medium text-muted-foreground">/ 100</span>
            </div>
            <ScoreBadge score={matchScore} verdict={verdict} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
