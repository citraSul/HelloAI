import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/page-header";
import { TailorStudio } from "@/components/tailor-studio";

export default function TailorPage() {
  return (
    <AppShell title="Tailor" fullWidth>
      <PageHeader
        title="Tailoring studio"
        description="Select a resume and job, then score, tailor, and evaluate impact — side by side for clarity."
      />
      <TailorStudio />
    </AppShell>
  );
}
