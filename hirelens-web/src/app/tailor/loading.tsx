import { AppShell } from "@/components/layout/app-shell";
import { TailorLoadingInner } from "@/components/skeletons/loading-ui";

export default function TailorLoading() {
  return (
    <AppShell title="Tailor" fullWidth>
      <TailorLoadingInner />
    </AppShell>
  );
}
