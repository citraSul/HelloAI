/** Shared types for HireLens dashboard components */

import type { ReactNode } from "react";

export type MatchVerdict = "strong" | "medium" | "weak";

export interface JobCardData {
  id: string;
  title: string;
  company: string;
  matchScore: number;
  impactScore: number;
  missingKeywordCount: number;
  href?: string;
}

export interface BreakdownSegment {
  label: string;
  value: number;
  /** 0–100 */
  score: number;
}

export interface DiffLine {
  type: "unchanged" | "added" | "removed";
  text: string;
}

export interface MetricItem {
  label: string;
  value: string | number;
  hint?: string;
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
}
