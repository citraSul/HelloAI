import { AppShell } from "@/components/layout/app-shell";
import { AnalyticsLoadingInner } from "@/components/skeletons/loading-ui";

export default function AnalyticsLoading() {
  return (
    <AppShell title="Analytics">
      <AnalyticsLoadingInner />
    </AppShell>
  );
}
