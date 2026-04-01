# HireLens — reusable dashboard components

TypeScript React components (Tailwind CSS class names). Copy into a Next.js App Router app (`components/ui/` or `src/components/`) and ensure Tailwind scans this folder.

## Install (in your Next app)

```bash
npm install react react-dom
# Tailwind + shadcn already in your project
```

## Usage examples

### `ScoreBadge`

```tsx
import { ScoreBadge } from "@/components/hirelens/score-badge";

<ScoreBadge score={78} label="Match score" verdict="strong" size="md" />
```

### `JobCard`

```tsx
import { JobCard } from "@/components/hirelens/job-card";

<JobCard
  job={{
    id: "1",
    title: "Senior Engineer",
    company: "Acme",
    matchScore: 78,
    impactScore: 64,
    missingKeywordCount: 3,
    href: "/jobs/1",
  }}
/>
```

### `MatchBreakdownChart`

```tsx
import { MatchBreakdownChart } from "@/components/hirelens/match-breakdown-chart";

<MatchBreakdownChart
  title="Fit breakdown"
  segments={[
    { label: "Required skills", value: 0.4, score: 82 },
    { label: "Experience", value: 0.25, score: 71 },
  ]}
/>
```

### `ResumeDiffViewer`

```tsx
import { ResumeDiffViewer } from "@/components/hirelens/resume-diff-viewer";

<ResumeDiffViewer
  variant="unified"
  lines={[
    { type: "unchanged", text: "Engineer with 5 years experience." },
    { type: "removed", text: "Skills: Java" },
    { type: "added", text: "Skills: Python, Django" },
  ]}
/>
```

### `MetricsPanel`

```tsx
import { MetricsPanel } from "@/components/hirelens/metrics-panel";

<MetricsPanel
  title="ATS & impact"
  items={[
    { label: "ATS proxy", value: "42 → 68" },
    { label: "Impact score", value: "71", hint: "rule-based" },
  ]}
  footnote="Scores are explainable proxies, not vendor ATS."
/>
```

### `SidebarNavigation`

```tsx
import { SidebarNavigation } from "@/components/hirelens/sidebar-navigation";

<SidebarNavigation
  brand="HireLens"
  activePath={pathname}
  items={[
    { id: "dash", label: "Dashboard", href: "/dashboard" },
    { id: "studio", label: "Studio", href: "/studio" },
  ]}
/>
```

## Files

| File | Purpose |
|------|---------|
| `types.ts` | Shared interfaces |
| `score-badge.tsx` | Numeric score pill |
| `job-card.tsx` | Dashboard job row |
| `match-breakdown-chart.tsx` | Horizontal bar breakdown |
| `resume-diff-viewer.tsx` | Before/after diff |
| `metrics-panel.tsx` | DL metrics block |
| `sidebar-navigation.tsx` | Left nav |
| `examples.tsx` | Composed demo snippet |
| `index.ts` | Barrel exports |
