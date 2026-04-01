"use client";

import type { MatchVerdict } from "./types";

export interface ScoreBadgeProps {
  /** 0–100 display value */
  score: number;
  /** Optional semantic verdict for color + ARIA */
  verdict?: MatchVerdict;
  /** Accessible label, e.g. "Match score" */
  label: string;
  /** Smaller variant for dense layouts */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const verdictStyles: Record<MatchVerdict, string> = {
  strong: "bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800",
  medium: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800",
  weak: "bg-rose-50 text-rose-900 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-800",
};

const sizeStyles = {
  sm: "text-xs px-2 py-0.5 min-w-[2.5rem]",
  md: "text-sm px-2.5 py-1 min-w-[3rem]",
  lg: "text-base font-semibold px-3 py-1.5 min-w-[3.5rem]",
};

/**
 * Compact numeric score with optional verdict coloring.
 */
export function ScoreBadge({
  score,
  verdict,
  label,
  size = "md",
  className = "",
}: ScoreBadgeProps) {
  const rounded = Math.round(Math.max(0, Math.min(100, score)));
  const v = verdict ?? (rounded >= 72 ? "strong" : rounded >= 48 ? "medium" : "weak");
  const color = verdictStyles[v];

  return (
    <span
      role="status"
      aria-label={`${label}: ${rounded} out of 100`}
      className={`inline-flex items-center justify-center rounded-full font-medium tabular-nums ring-1 ring-inset ${sizeStyles[size]} ${color} ${className}`}
    >
      {rounded}
    </span>
  );
}
