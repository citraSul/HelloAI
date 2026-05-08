/**
 * Compact relative time for trust / freshness lines (server- and client-safe).
 */
export function formatShortRelativeTime(iso: string | null | undefined, nowMs = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diffMs = nowMs - t;
  if (diffMs < 0) return "just now";
  const absSec = Math.round(diffMs / 1000);
  if (absSec < 45) return "just now";
  const absMin = Math.round(absSec / 60);
  if (absMin < 60) return `${absMin}m ago`;
  const absH = Math.round(absMin / 60);
  if (absH < 36) return `${absH}h ago`;
  const absD = Math.round(absH / 24);
  if (absD < 21) return `${absD}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
