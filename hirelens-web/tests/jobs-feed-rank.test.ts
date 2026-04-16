import { describe, expect, it } from "vitest";
import { rankJobsForFeed, type FeedSortKey } from "@/lib/jobs-feed-rank";

function j(
  id: string,
  updatedAtMs: number,
  match: { matchScore: number; verdict: string } | null,
) {
  return {
    id,
    updatedAt: new Date(updatedAtMs),
    matchAnalyses: match ? [match] : [],
  };
}

function key(tier: number, matchScore: number, updatedAtMs: number): FeedSortKey {
  return { tier, matchScore, updatedAtMs };
}

describe("rankJobsForFeed", () => {
  it("newest: orders by job updatedAt only", () => {
    const rows = [j("a", 1000, null), j("b", 3000, null), j("c", 2000, null)];
    const out = rankJobsForFeed(rows, "newest");
    expect(out.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("fit + sortKey: tier dominates (Apply above Skip despite lower score)", () => {
    const rows = [
      j("skip_high", 100, { matchScore: 0.95, verdict: "strong" }),
      j("apply_low", 200, { matchScore: 0.4, verdict: "weak" }),
    ];
    const keys: Record<string, FeedSortKey> = {
      skip_high: key(1, 0.95, 100),
      apply_low: key(3, 0.4, 200),
    };
    const out = rankJobsForFeed(rows, "fit", (row) => keys[row.id]!);
    expect(out.map((r) => r.id)).toEqual(["apply_low", "skip_high"]);
  });

  it("fit + sortKey: within tier, higher match first; then recency", () => {
    const rows = [
      j("a", 100, { matchScore: 0.7, verdict: "moderate" }),
      j("b", 200, { matchScore: 0.85, verdict: "strong" }),
      j("c", 300, { matchScore: 0.85, verdict: "strong" }),
    ];
    const keys: Record<string, FeedSortKey> = {
      a: key(3, 0.7, 100),
      b: key(3, 0.85, 200),
      c: key(3, 0.85, 300),
    };
    const out = rankJobsForFeed(rows, "fit", (row) => keys[row.id]!);
    expect(out.map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("fit + sortKey: unscored tier 0 after scored", () => {
    const rows = [
      j("no_score", 9999, null),
      j("scored", 100, { matchScore: 0.5, verdict: "weak" }),
    ];
    const keys: Record<string, FeedSortKey> = {
      no_score: key(0, 0, 9999),
      scored: key(2, 0.5, 100),
    };
    const out = rankJobsForFeed(rows, "fit", (row) => keys[row.id]!);
    expect(out[0]!.id).toBe("scored");
    expect(out[1]!.id).toBe("no_score");
  });

  it("fit without sortKey: match score desc, unscored last", () => {
    const rows = [
      j("old_weak", 100, { matchScore: 0.5, verdict: "weak" }),
      j("no_score", 9999, null),
      j("strong", 200, { matchScore: 0.9, verdict: "strong" }),
      j("mid", 150, { matchScore: 0.75, verdict: "moderate" }),
    ];
    const out = rankJobsForFeed(rows, "fit");
    expect(out.map((r) => r.id)).toEqual(["strong", "mid", "old_weak", "no_score"]);
  });

  it("score: match score desc then recency", () => {
    const rows = [
      j("newer", 200, { matchScore: 0.7, verdict: "poor" }),
      j("older", 100, { matchScore: 0.7, verdict: "strong" }),
    ];
    const out = rankJobsForFeed(rows, "score");
    expect(out.map((r) => r.id)).toEqual(["newer", "older"]);
  });
});
