import { Card, CardContent } from "@/components/ui/card";
import { ScoreBadge } from "@/components/score-badge";

export function JobMatchHero({
  company,
  matchScore,
  verdict,
  resumeTitle,
}: {
  company: string | null;
  matchScore: number;
  verdict: string;
  resumeTitle?: string | null;
}) {
  const pct = Math.round(matchScore * 100);

  return (
    <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card/95 to-surface/35 shadow-brand-soft ring-primary/10">
      <CardContent className="p-6 md:p-8 md:pb-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-label">Match signal</p>
        {resumeTitle && <p className="mt-1 text-xs text-muted-foreground">For resume: {resumeTitle}</p>}
        <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{company ?? "Role"}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your strongest alignment vs this posting — use gaps to guide tailoring.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground/90">
              This % is match signal only (fit to the posting). Apply · Consider · Skip and recommendation certainty live
              in HireLens recommendation above — different concepts.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-semibold tabular-nums tracking-[-0.03em] text-foreground md:text-6xl">
                {pct}
              </span>
              <span className="text-lg font-medium tabular-nums text-muted-foreground">/ 100</span>
            </div>
            <ScoreBadge score={matchScore} verdict={verdict} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
