import { AppShell } from "@/components/layout/app-shell";
import { DashboardLoadingInner } from "@/components/skeletons/loading-ui";

export default function DashboardLoading() {
  return (
    <AppShell title="Dashboard">
      <DashboardLoadingInner />
    </AppShell>
  );
}
