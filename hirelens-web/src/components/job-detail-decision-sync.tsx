import type { JobDetailDecisionSync } from "@/lib/services/decision-service";
import { formatShortRelativeTime } from "@/lib/format-short-relative-time";
import { cn } from "@/lib/utils/cn";

function FreshnessLine({ sync }: { sync: JobDetailDecisionSync }) {
  const parts: string[] = [];
  const m = formatShortRelativeTime(sync.matchScoredAt);
  if (m) parts.push(`Match scored ${m}`);
  const tr = formatShortRelativeTime(sync.tailoredSavedAt);
  if (tr) parts.push(`Tailored draft saved ${tr}`);
  const im = formatShortRelativeTime(sync.impactEvaluatedAt);
  if (im) parts.push(`Impact evaluated ${im}`);
  const d = formatShortRelativeTime(sync.decisionSavedAt);
  if (d) parts.push(`Decision record saved ${d}`);
  const sup = formatShortRelativeTime(sync.supersededDecisionSavedAt);
  if (sup) parts.push(`Prior save ${sup} (superseded — view shows live compute)`);
  if (parts.length === 0) return null;
  return (
    <p className="text-[10px] leading-relaxed text-muted-foreground/95">
      <span className="font-medium text-foreground/85">Freshness: </span>
      {parts.join(" · ")}
    </p>
  );
}

/**
 * Read-only trust line: how the job-detail recommendation lines up with match, impact, and any stored decision row.
 * No extra data fetching — uses `sync` from the same load as the recommendation.
 */
export function JobDetailDecisionSyncLine({ sync }: { sync: JobDetailDecisionSync | null }) {
  if (!sync) return null;

  const statusText = (() => {
    if (sync.displaySource === "persisted_aligned") {
      if (sync.provenance === "match_and_impact") {
        return "Saved recommendation is in sync with your latest match score and tailored-impact evaluation (same impact pointer as the engine).";
      }
      if (sync.provenance === "match_only") {
        return "Saved recommendation matches your latest match score; tailored impact is not part of this snapshot — run Evaluate impact in Tailor if you want impact folded in.";
      }
      return "Saved recommendation matches your latest pointers for this resume (provisional until you run Score match when needed).";
    }

    if (sync.supersededPersistedDecision) {
      return "A previous saved decision didn’t match your current match or impact pointers — showing a freshly computed recommendation from latest data.";
    }

    if (sync.provenance === "match_and_impact") {
      return "Live recommendation — computed now from your latest match plus tailored impact from your newest Evaluate impact run for this pair.";
    }

    if (sync.hasTailoredVersion && !sync.hasImpactForActiveTailored) {
      return "Live recommendation from match scoring; you have a tailored draft but no impact evaluation on the active version yet — use Tailor → Evaluate impact to connect impact to this card.";
    }

    return "Live recommendation from your latest match scoring (no tailored impact in this evaluation yet).";
  })();

  return (
    <div className="mt-5 max-w-3xl space-y-2.5">
      {sync.impactStaleVsLatestTailor ? (
        <p
          className={cn(
            "rounded-lg border border-score-warning/45 bg-score-warning/10 px-3 py-2 text-xs leading-relaxed text-foreground",
          )}
          role="status"
        >
          <span className="font-medium text-foreground">Tailored draft changed after the last impact run.</span> Run{" "}
          <span className="font-medium">Evaluate impact</span> in Tailor so recommendation certainty can reflect your
          latest text — then use <span className="font-medium">Score match</span> here if you want the posted match %
          updated too.
        </p>
      ) : null}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground/90">Sync: </span>
        {statusText}
      </p>
      <FreshnessLine sync={sync} />
    </div>
  );
}
