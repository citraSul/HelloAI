import { AppShell } from "@/components/layout/app-shell";
import { JobDetailLoadingInner } from "@/components/skeletons/loading-ui";

export default function JobDetailLoading() {
  return (
    <AppShell title="Job">
      <JobDetailLoadingInner />
    </AppShell>
  );
}
