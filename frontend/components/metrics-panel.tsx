"use client";

import type { MetricItem } from "./types";

export interface MetricsPanelProps {
  title: string;
  items: MetricItem[];
  /** Optional footer note */
  footnote?: string;
  className?: string;
}

/**
 * Key/value metrics for ATS, impact, or funnel stats.
 */
export function MetricsPanel({ title, items, footnote, className = "" }: MetricsPanelProps) {
  const headingId = `metrics-panel-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/50 ${className}`}
      aria-labelledby={headingId}
    >
      <h3 id={headingId} className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
        {title}
      </h3>
      <dl className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
            <dt className="text-xs text-slate-500 dark:text-slate-400">{item.label}</dt>
            <dd className="text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums">
              {item.value}
              {item.hint ? (
                <span className="block text-xs font-normal text-slate-500 dark:text-slate-500 mt-0.5 sm:mt-0 sm:inline sm:ml-2">
                  {item.hint}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      {footnote ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">
          {footnote}
        </p>
      ) : null}
    </section>
  );
}
