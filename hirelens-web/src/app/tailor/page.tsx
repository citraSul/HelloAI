import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/page-header";
import { TailorStudio } from "@/components/tailor-studio";
import { Card, CardContent } from "@/components/ui/card";
import { isMockMode } from "@/lib/config/app-mode";
import { Shimmer } from "@/components/skeletons/loading-ui";

export default function TailorPage() {
  const mockMode = isMockMode();

  return (
    <AppShell title="Tailor" fullWidth>
      <PageHeader
        title="Tailoring studio"
        description="Select a resume and job, then score, tailor, and evaluate impact — side by side for clarity."
      />
      <Card>
        <CardContent className="p-6">
          <Suspense
            fallback={
              <div className="space-y-4 py-2" aria-hidden>
                <Shimmer className="h-10 w-full max-w-md rounded-xl" />
                <div className="flex flex-wrap gap-4">
                  <Shimmer className="h-10 flex-1 min-w-[160px] rounded-xl" />
                  <Shimmer className="h-10 flex-1 min-w-[160px] rounded-xl" />
                </div>
              </div>
            }
          >
            <TailorStudio mockMode={mockMode} />
          </Suspense>
        </CardContent>
      </Card>
    </AppShell>
  );
}
