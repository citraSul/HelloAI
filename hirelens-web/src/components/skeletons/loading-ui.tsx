import { cn } from "@/lib/utils/cn";

/** Dark-theme pulse block — matches card/muted surfaces */
export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/50", className)}
      aria-hidden
    />
  );
}

export function PageHeaderSkeleton({ actionSlot = false }: { actionSlot?: boolean }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-3">
        <Shimmer className="h-8 w-48 max-w-[80%]" />
        <Shimmer className="h-4 w-full max-w-xl" />
        <Shimmer className="h-4 w-2/3 max-w-lg" />
      </div>
      {actionSlot && <Shimmer className="h-10 w-36 shrink-0 rounded-xl" />}
    </div>
  );
}

export function CardSkeleton({
  className,
  titleWidth = "w-40",
  lines = 3,
}: {
  className?: string;
  titleWidth?: string;
  lines?: number;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card/40 p-6 shadow-sm", className)}>
      <Shimmer className={cn("mb-4 h-5", titleWidth)} />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Shimmer key={i} className={cn("h-3", i === lines - 1 ? "w-4/5" : "w-full")} />
        ))}
      </div>
    </div>
  );
}

export function DashboardLoadingInner() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} lines={2} titleWidth="w-24" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <CardSkeleton lines={6} className="min-h-[200px]" />
        <CardSkeleton lines={6} className="min-h-[200px]" />
      </div>
    </>
  );
}

export function JobsLoadingInner() {
  return (
    <>
      <PageHeaderSkeleton actionSlot />
      <div className="mb-10 space-y-4">
        <Shimmer className="h-32 w-full rounded-2xl border border-border border-dashed border-border/80" />
      </div>
      <ul className="space-y-3" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="rounded-2xl border border-border bg-card/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Shimmer className="h-5 w-2/3 max-w-md" />
                <Shimmer className="h-3 w-24" />
              </div>
              <Shimmer className="h-8 w-20 rounded-full" />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function JobDetailLoadingInner() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <CardSkeleton lines={4} className="min-h-[180px]" />
        </div>
        <div className="w-full shrink-0 lg:w-[360px]">
          <CardSkeleton lines={5} className="min-h-[200px]" />
        </div>
      </div>
      <Shimmer className="mb-8 h-28 w-full rounded-2xl border border-border" />
      <div className="mb-8 space-y-3">
        <Shimmer className="h-4 w-32" />
        <Shimmer className="h-24 w-full rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <CardSkeleton lines={8} titleWidth="w-28" />
        <CardSkeleton lines={8} titleWidth="w-28" />
      </div>
      <div className="mt-6">
        <CardSkeleton lines={4} titleWidth="w-36" />
      </div>
    </>
  );
}

export function ResumesLoadingInner() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mb-8">
        <Shimmer className="h-28 w-full rounded-2xl border border-border border-dashed border-border/80" />
      </div>
      <ul className="space-y-3" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="rounded-2xl border border-border bg-card/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Shimmer className="h-5 w-2/5 max-w-xs" />
                <Shimmer className="h-3 w-full max-w-2xl" />
                <Shimmer className="h-3 w-3/4" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function TailorLoadingInner() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="rounded-2xl border border-border bg-card/40 p-6">
        <Shimmer className="mb-6 h-16 w-full max-w-2xl rounded-xl" />
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1 space-y-2">
            <Shimmer className="h-3 w-16" />
            <Shimmer className="h-10 w-full rounded-xl" />
          </div>
          <div className="min-w-[200px] flex-1 space-y-2">
            <Shimmer className="h-3 w-12" />
            <Shimmer className="h-10 w-full rounded-xl" />
          </div>
          <div className="flex gap-2">
            <Shimmer className="h-10 w-32 rounded-lg" />
            <Shimmer className="h-10 w-36 rounded-lg" />
          </div>
        </div>
        <div className="mt-8 grid min-h-[320px] gap-4 lg:grid-cols-[1fr_1fr_280px]">
          <Shimmer className="min-h-[280px] rounded-2xl border border-border" />
          <Shimmer className="min-h-[280px] rounded-2xl border border-border" />
          <Shimmer className="min-h-[280px] rounded-2xl border border-border" />
        </div>
      </div>
    </>
  );
}

export function AnalyticsLoadingInner() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} lines={2} titleWidth="w-20" />
        ))}
      </div>
      <Shimmer className="mb-8 h-64 w-full rounded-2xl border border-border" />
      <div className="grid gap-6 lg:grid-cols-2">
        <CardSkeleton lines={6} />
        <CardSkeleton lines={6} />
      </div>
    </>
  );
}
