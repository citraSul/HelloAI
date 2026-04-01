/**
 * Usage examples — import pieces into a Next.js page or Storybook.
 * Not rendered by default.
 */

import {
  JobCard,
  MatchBreakdownChart,
  MetricsPanel,
  ResumeDiffViewer,
  ScoreBadge,
  SidebarNavigation,
} from "./index";

const mockJob = {
  id: "1",
  title: "Senior Software Engineer",
  company: "Acme Corp",
  matchScore: 78,
  impactScore: 64,
  missingKeywordCount: 4,
  href: "/jobs/1",
};

const mockSegments = [
  { label: "Required skills", value: 0.4, score: 82 },
  { label: "Experience fit", value: 0.25, score: 71 },
  { label: "Tools", value: 0.15, score: 60 },
];

const mockDiff = [
  { type: "unchanged" as const, text: "Senior engineer with 6+ years building APIs." },
  { type: "removed" as const, text: "Skills: Java, Spring" },
  { type: "added" as const, text: "Skills: Python, Django, Kubernetes" },
];

const mockNav = [
  { id: "dash", label: "Dashboard", href: "/dashboard" },
  { id: "studio", label: "Tailoring", href: "/studio" },
];

export function ExampleDashboardSnippet() {
  return (
    <div className="max-w-xl space-y-4 p-4">
      <ScoreBadge score={82} label="Match score" size="lg" />
      <JobCard job={mockJob} />
      <MatchBreakdownChart segments={mockSegments} />
      <MetricsPanel
        title="Impact"
        items={[
          { label: "ATS (before → after)", value: "42 → 68" },
          { label: "Keyword gain", value: "+12 pp", hint: "vs JD focus terms" },
        ]}
      />
      <ResumeDiffViewer lines={mockDiff} variant="unified" />
      <div className="flex h-64 w-56 overflow-hidden rounded-lg border">
        <SidebarNavigation brand="HireLens" items={mockNav} activePath="/dashboard" />
      </div>
    </div>
  );
}
