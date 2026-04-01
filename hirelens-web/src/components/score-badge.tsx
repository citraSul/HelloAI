import { cn } from "@/lib/utils/cn";

const warnRing =
  "bg-score-warning/12 text-score-warning ring-1 ring-score-warning/20 shadow-[0_0_16px_rgba(245,158,11,0.08)]";

const verdictStyles: Record<string, string> = {
  strong: "bg-score-success/12 text-score-success ring-1 ring-score-success/20 shadow-[0_0_16px_rgba(34,197,94,0.08)]",
  moderate: warnRing,
  medium: warnRing,
  weak: "bg-score-warning/10 text-score-warning/90 ring-1 ring-score-warning/15",
  poor: "bg-score-danger/12 text-score-danger ring-1 ring-score-danger/20 shadow-[0_0_16px_rgba(239,68,68,0.08)]",
};

export function ScoreBadge({ score, verdict }: { score: number; verdict: string }) {
  const pct = Math.round(score * 100);
  const key = verdict.toLowerCase();
  const tone = verdictStyles[key] ?? verdictStyles.poor;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200",
        tone,
      )}
    >
      {pct}% · {verdict}
    </span>
  );
}

/** Impact / secondary metrics — purple accent per design system */
export function ImpactBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-score-impact/12 px-3 py-1 text-xs font-medium text-score-impact ring-1 ring-score-impact/25">
      {label}
    </span>
  );
}
