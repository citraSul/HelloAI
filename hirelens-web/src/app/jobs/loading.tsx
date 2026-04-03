import { AppShell } from "@/components/layout/app-shell";
import { JobsLoadingInner } from "@/components/skeletons/loading-ui";

export default function JobsLoading() {
  return (
    <AppShell title="Jobs">
      <JobsLoadingInner />
    </AppShell>
  );
}
