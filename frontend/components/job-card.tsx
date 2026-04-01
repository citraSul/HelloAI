"use client";

import type { JobCardData } from "./types";
import { ScoreBadge } from "./score-badge";

export interface JobCardProps {
  job: JobCardData;
  /** Called when card is activated (keyboard or click) */
  onOpen?: (job: JobCardData) => void;
  className?: string;
}

/**
 * Dashboard job row / card with match + impact + missing keyword count.
 */
export function JobCard({ job, onOpen, className = "" }: JobCardProps) {
  const verdict =
    job.matchScore >= 72 ? "strong" : job.matchScore >= 48 ? "medium" : "weak";

  const inner = (
    <>
      <div className="flex flex-col gap-1 min-w-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50 truncate">
            {job.title}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{job.company}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <ScoreBadge score={job.matchScore} verdict={verdict} label="Match score" size="sm" />
          <ScoreBadge score={job.impactScore} label="Impact score" size="sm" />
          <span
            className="text-xs text-slate-500 dark:text-slate-400 tabular-nums"
            aria-label={`${job.missingKeywordCount} missing keywords`}
          >
            {job.missingKeywordCount} missing
          </span>
        </div>
      </div>
    </>
  );

  if (job.href) {
    return (
      <a
        href={job.href}
        className={`block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600 ${className}`}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen?.(job)}
      className={`w-full text-left rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600 ${className}`}
    >
      {inner}
    </button>
  );
}
