type Row = { label: string; value: number };

export function AnalyticsBarChart({ rows, max }: { rows: Row[]; max?: number }) {
  const cap = max ?? Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="space-y-4" role="img" aria-label="Bar chart">
      {rows.map((r) => {
        const pct = Math.min(100, Math.round((r.value / cap) * 100));
        return (
          <div key={r.label} className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="tabular-nums font-medium text-foreground">{r.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/70 transition-[width] duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
