const BREAKDOWN_META_KEYS = new Set(["strengths", "gaps", "reasoning", "missing_keywords"]);

function formatDimLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function topDimensionSnippet(breakdown: unknown): string | null {
  if (!breakdown || typeof breakdown !== "object") return null;
  const b = breakdown as Record<string, unknown>;
  let best: { key: string; value: number } | null = null;
  for (const [k, v] of Object.entries(b)) {
    if (BREAKDOWN_META_KEYS.has(k) || typeof v !== "number" || !Number.isFinite(v)) continue;
    if (!best || v > best.value) best = { key: k, value: v };
  }
  if (!best) return null;
  return `Best fit: ${formatDimLabel(best.key)} (${Math.round(best.value * 100)}%)`;
}

/** One line from stored match breakdown; prefers narrative, then strengths/gaps/keywords/dimensions. */
export function whyLineFromBreakdown(breakdown: unknown): string | null {
  if (!breakdown || typeof breakdown !== "object") return null;
  const b = breakdown as Record<string, unknown>;

  if (typeof b.reasoning === "string" && b.reasoning.trim()) {
    const t = b.reasoning.trim().replace(/\s+/g, " ");
    return t.length > 130 ? `${t.slice(0, 127)}…` : t;
  }

  if (Array.isArray(b.strengths)) {
    const first = b.strengths.find((x) => typeof x === "string" && x.trim());
    if (typeof first === "string") {
      const t = first.trim();
      return t.length > 110 ? `Strength: ${t.slice(0, 107)}…` : `Strength: ${t}`;
    }
  }

  if (Array.isArray(b.gaps)) {
    const first = b.gaps.find((x) => typeof x === "string" && x.trim());
    if (typeof first === "string") {
      const t = first.trim();
      return t.length > 110 ? `Gap: ${t.slice(0, 107)}…` : `Gap: ${t}`;
    }
  }

  if (Array.isArray(b.missing_keywords) && b.missing_keywords.length > 0) {
    const n = b.missing_keywords.length;
    return n === 1 ? "1 posting keyword missing vs resume" : `${n} posting keywords missing vs resume`;
  }

  return topDimensionSnippet(breakdown);
}

/** Fallback when breakdown has no narrative snippet. */
export function whyLineFromScoreFallback(matchScore: number, verdict: string): string {
  const pct = Math.round(matchScore * 100);
  return `${pct}% match (${verdict}) — open job for full breakdown`;
}
