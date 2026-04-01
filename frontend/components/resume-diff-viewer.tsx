"use client";

import type { DiffLine } from "./types";

export interface ResumeDiffViewerProps {
  lines: DiffLine[];
  /** unified = one column; split = two columns (original vs tailored filters) */
  variant?: "unified" | "split";
  leftTitle?: string;
  rightTitle?: string;
  className?: string;
}

const lineClass: Record<DiffLine["type"], string> = {
  unchanged:
    "border-l-2 border-transparent text-slate-800 dark:text-slate-200 pl-2",
  added:
    "border-l-2 border-emerald-500 bg-emerald-50/80 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100 pl-2",
  removed:
    "border-l-2 border-rose-500 bg-rose-50/80 text-rose-950 line-through decoration-rose-400/50 dark:bg-rose-950/40 dark:text-rose-100 pl-2",
};

/**
 * Line-based resume diff. Pass lines from your diff engine or mock data.
 */
export function ResumeDiffViewer({
  lines,
  variant = "unified",
  leftTitle = "Original",
  rightTitle = "Tailored",
  className = "",
}: ResumeDiffViewerProps) {
  if (variant === "unified") {
    return (
      <div
        className={`rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden ${className}`}
        role="region"
        aria-label="Resume diff"
      >
        <div className="bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
          Changes
        </div>
        <pre
          className="p-3 text-xs font-mono whitespace-pre-wrap max-h-[min(70vh,560px)] overflow-y-auto"
          tabIndex={0}
        >
          {lines.map((l, i) => (
            <span
              key={i}
              className={`block py-1 rounded-r ${lineClass[l.type]}`}
              aria-label={
                l.type === "added"
                  ? "Added line"
                  : l.type === "removed"
                    ? "Removed line"
                    : "Unchanged line"
              }
            >
              {l.text}
            </span>
          ))}
        </pre>
      </div>
    );
  }

  return (
    <div
      className={`grid gap-4 md:grid-cols-2 ${className}`}
      role="region"
      aria-label="Resume side by side comparison"
    >
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs font-medium">{leftTitle}</div>
        <pre className="p-3 text-xs font-mono whitespace-pre-wrap max-h-[min(60vh,480px)] overflow-y-auto" tabIndex={0}>
          {lines
            .filter((l) => l.type !== "added")
            .map((l, i) => (
              <span key={`l-${i}`} className={`block py-0.5 ${lineClass[l.type]}`}>
                {l.text}
              </span>
            ))}
        </pre>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs font-medium">{rightTitle}</div>
        <pre className="p-3 text-xs font-mono whitespace-pre-wrap max-h-[min(60vh,480px)] overflow-y-auto" tabIndex={0}>
          {lines
            .filter((l) => l.type !== "removed")
            .map((l, i) => (
              <span key={`r-${i}`} className={`block py-0.5 ${lineClass[l.type]}`}>
                {l.text}
              </span>
            ))}
        </pre>
      </div>
    </div>
  );
}
