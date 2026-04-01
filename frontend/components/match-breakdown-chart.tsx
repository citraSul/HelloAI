"use client";

import type { BreakdownSegment } from "./types";

export interface MatchBreakdownChartProps {
  segments: BreakdownSegment[];
  /** Accessible title for the chart */
  title?: string;
  className?: string;
}

/**
 * Horizontal bar breakdown (skills / experience / tools) — no chart library.
 */
export function MatchBreakdownChart({
  segments,
  title = "Match breakdown",
  className = "",
}: MatchBreakdownChartProps) {
  const description = segments.map((s) => `${s.label} ${Math.round(s.score)}%`).join(", ");

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/50 ${className}`}
      role="group"
      aria-label={title}
    >
      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">{title}</h4>
      <div
        className="sr-only"
        id="match-breakdown-summary"
      >
        {description}
      </div>
      <ul className="space-y-3" aria-describedby="match-breakdown-summary">
        {segments.map((seg, idx) => (
          <li key={`${seg.label}-${idx}`}>
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
              <span id={`seg-label-${idx}`}>{seg.label}</span>
              <span className="tabular-nums" aria-hidden>
                {Math.round(seg.score)}%
              </span>
            </div>
            <div
              className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(seg.score)}
              aria-labelledby={`seg-label-${idx}`}
            >
              <div
                className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-[width] duration-300"
                style={{ width: `${Math.min(100, Math.max(0, seg.score))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
