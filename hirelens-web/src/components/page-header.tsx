export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <h1 className="text-[1.625rem] font-semibold tracking-[-0.02em] text-foreground md:text-3xl md:tracking-[-0.02em]">
          {title}
        </h1>
        {description && (
          <p className="max-w-3xl text-[15px] leading-[1.65] text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-start gap-3 pt-0.5">{children}</div>}
    </div>
  );
}
