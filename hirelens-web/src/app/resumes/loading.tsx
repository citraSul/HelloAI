import { AppShell } from "@/components/layout/app-shell";
import { ResumesLoadingInner } from "@/components/skeletons/loading-ui";

export default function ResumesLoading() {
  return (
    <AppShell title="Resumes">
      <ResumesLoadingInner />
    </AppShell>
  );
}
