import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopNavbar } from "@/components/layout/top-navbar";

export function AppShell({
  title,
  children,
  fullWidth,
}: {
  title: string;
  children: React.ReactNode;
  /** Use full content width (e.g. Tailoring Studio). */
  fullWidth?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background pl-60">
      <AppSidebar />
      <div className="flex min-h-screen flex-col">
        <TopNavbar title={title} />
        <main className="flex-1 px-6 py-8 md:px-8">
          <div className={fullWidth ? "w-full max-w-none" : "mx-auto max-w-7xl"}>{children}</div>
        </main>
      </div>
    </div>
  );
}
