export type MatchVerdict = "strong" | "moderate" | "weak" | "poor";

export interface DashboardOverview {
  activeJobs: number;
  resumesIndexed: number;
  avgMatchScore: number;
  lastRunAt: string | null;
  recentActivity: { id: string; label: string; at: string }[];
}

export interface JobSummary {
  id: string;
  title: string;
  company: string | null;
  matchScore?: number;
  verdict?: MatchVerdict;
}
