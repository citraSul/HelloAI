import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRuntimeHealthSnapshot } from "@/lib/config/runtime-health";
import { isFlaskPipelineEnabled } from "@/lib/flask/env";

export const dynamic = "force-dynamic";

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">
        {ok ? <span className="text-score-success">OK</span> : <span className="text-score-danger">Issue</span>}
        {detail && <span className="mt-1 block text-xs font-normal text-label">{detail}</span>}
      </span>
    </div>
  );
}

export default async function DiagnosticsPage() {
  const health = await getRuntimeHealthSnapshot();
  const pipelineActive = isFlaskPipelineEnabled();

  return (
    <AppShell title="Diagnostics">
      <PageHeader
        title="Diagnostics"
        description="Local development health — no secrets are shown. Use this to verify DATABASE_URL, schema, and pipeline configuration."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Application mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>
              <span className="text-label">APP_MODE:</span>{" "}
              <span className="font-mono text-foreground">{health.appMode}</span>
            </p>
            <p>
              <span className="text-label">Match / tailor / impact:</span>{" "}
              {pipelineActive ? (
                <span className="text-foreground">Using Flask pipeline (APP_MODE=real + credentials)</span>
              ) : (
                <span className="text-foreground">Using built-in mocks (APP_MODE=mock, or REAL without full credentials)</span>
              )}
            </p>
            {health.realModePipelineMismatch && (
              <p className="text-sm text-score-warning">{health.realModeMismatchMessage}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusRow label="DATABASE_URL is set" ok={health.databaseUrlPresent} />
            <StatusRow
              label="Prisma can connect"
              ok={health.prismaConnected}
              detail={health.prismaError}
            />
            <StatusRow label="Required tables reachable" ok={health.allRequiredTablesOk} />
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-label">Table checks</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {health.tables.map((t) => (
                  <li key={t.name} className="flex justify-between gap-2 font-mono">
                    <span>{t.name}</span>
                    <span className={t.ok ? "text-score-success" : "text-score-danger"}>
                      {t.ok ? "ok" : t.error ?? "error"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Flask / pipeline env</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusRow label="FLASK_BASE_URL set" ok={health.flaskBaseUrlConfigured} />
            <StatusRow label="HIRELENS_INTERNAL_API_KEY set" ok={health.hirelensInternalApiKeyConfigured} />
            <StatusRow
              label="Pipeline active (APP_MODE=real + URL + key)"
              ok={health.pipelineWouldCallFlask}
              detail={
                health.pipelineWouldCallFlask
                  ? "Next.js will call Flask for match / tailor / impact."
                  : health.appMode === "mock"
                    ? "APP_MODE=mock — mocks are used; set APP_MODE=real and both env vars to call Flask."
                    : "Set FLASK_BASE_URL and HIRELENS_INTERNAL_API_KEY for REAL mode."
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Real pipeline validation (developers)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Use this checklist before running the manual matrix with <span className="font-mono text-foreground">APP_MODE=real</span>:
            </p>
            <ol className="list-inside list-decimal space-y-1.5 text-xs">
              <li>
                <span className="text-label">Pipeline active</span> above is <span className="text-score-success">OK</span> (or fix env and restart Next).
              </li>
              <li>Flask is running and matches <span className="font-mono">FLASK_BASE_URL</span>.</li>
              <li>API key matches Flask for internal routes.</li>
              <li>Optionally set <span className="font-mono">HIRELENS_PIPELINE_DEBUG=1</span> — server logs structured match/tailor/impact/decision lines.</li>
            </ol>
            <p className="text-xs text-label">
              Playbook: <code className="rounded bg-muted px-1.5 py-0.5 font-mono">hirelens-web/docs/REAL_PIPELINE_VALIDATION.md</code> — full matrix, one-case steps, rubric.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dashboard / Analytics sample data</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Sample KPIs may appear when your account has little activity, or when a query fails (e.g. missing table).
              Check the banner text on those pages — it distinguishes sparse data vs. setup issues when possible.
            </p>
            <p className="mt-2 text-xs text-label">
              See <code className="rounded bg-muted px-1.5 py-0.5 font-mono">docs/local-development.md</code> for setup.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
