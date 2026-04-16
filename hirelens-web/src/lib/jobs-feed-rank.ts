export const JOBS_FEED_SORTS = ["fit", "newest", "score"] as const;
export type JobsFeedSort = (typeof JOBS_FEED_SORTS)[number];

export function parseJobsFeedSort(raw: string | string[] | undefined | null): JobsFeedSort {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase() ?? "";
  return JOBS_FEED_SORTS.includes(v as JobsFeedSort) ? (v as JobsFeedSort) : "fit";
}

/** Precomputed for each job — must match `listApplyGuidanceFromDecisionOrMatch` badge tier. */
export type FeedSortKey = {
  /** Apply = 3, Consider = 2, Skip = 1, insufficient evidence for tier = 0 */
  tier: number;
  matchScore: number;
  updatedAtMs: number;
};

type RankableJob = {
  id: string;
  updatedAt: Date;
  matchAnalyses: Array<{ matchScore: number; verdict: string }>;
};

/**
 * - newest: job updatedAt desc * - fit: tier desc, matchScore desc, updatedAt desc (requires getFeedSortKey from bundle)
 * - fit without getFeedSortKey: match score desc, unscored last, updatedAt tie-break (legacy fallback)
 * - score: match score desc, unscored last, updatedAt tie-break
 */
export function rankJobsForFeed<T extends RankableJob>(
  jobs: T[],
  sort: JobsFeedSort,
  getFeedSortKey?: (job: T) => FeedSortKey,
): T[] {
  const copy = [...jobs];
  if (sort === "newest") {
    copy.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return copy;
  }

  if (sort === "fit" && getFeedSortKey) {
    copy.sort((a, b) => {
      const ka = getFeedSortKey(a);
      const kb = getFeedSortKey(b);
      if (kb.tier !== ka.tier) return kb.tier - ka.tier;
      if (Math.abs(kb.matchScore - ka.matchScore) > 1e-12) return kb.matchScore - ka.matchScore;
      return kb.updatedAtMs - ka.updatedAtMs;
    });
    return copy;
  }

  const byScoreThenRecency = (a: T, b: T): number => {
    const aM = a.matchAnalyses[0];
    const bM = b.matchAnalyses[0];
    if (aM && !bM) return -1;
    if (!aM && bM) return 1;
    if (!aM && !bM) return b.updatedAt.getTime() - a.updatedAt.getTime();
    const ds = bM!.matchScore - aM!.matchScore;
    if (Math.abs(ds) > 1e-12) return ds;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  };

  copy.sort((a, b) => byScoreThenRecency(a, b));
  return copy;
}
