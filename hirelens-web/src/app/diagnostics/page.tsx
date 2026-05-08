import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRuntimeHealthSnapshot } from "@/lib/config/runtime-health";
import { isFlaskPipelineEnabled } from "@/lib/flask/env";
import { probeFlaskHealthForDiagnostics } from "@/lib/operational/flask-reachability";
import { getIngestOperationalTrustSnapshot } from "@/lib/services/ingest-operational-log";

export const dynamic = "force-dynamic";

function formatWhen(dt: Date | null | undefined): string {
  if (!dt) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(dt);
}

function SourceErrorsBlock({ raw }: { raw: unknown }) {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length === 0) return null;
  return (
    <div className="rounded-lg border border-score-warning/30 bg-score-warning/5 px-3 py-2">
      <p className="text-[11px] font-medium text-score-warning">Feed source failures (last run)</p>
      <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
        {list.map((item, i) => {
          const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          const src = String(o.source ?? "unknown");
          const msg = String(o.message ?? "");
          return (
            <li key={i}>
              <span className="font-mono text-foreground">{src}</span>: {msg}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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
  const [health, ingestTrust, flaskLive] = await Promise.all([
    getRuntimeHealthSnapshot(),
    getIngestOperationalTrustSnapshot(),
    probeFlaskHealthForDiagnostics(),
  ]);
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
            <CardTitle>Operational trust — ingestion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p className="text-xs text-label">
              Records one row per successful <span className="font-mono">POST /api/jobs/ingest</span> run (after{" "}
              <span className="font-mono">CRON_SECRET</span> auth). Unauthorized attempts are not logged here.
            </p>
            {!ingestTrust.available ? (
              <p className="text-sm text-score-warning">{ingestTrust.reason}</p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-label">Last ingest run</p>
                    {ingestTrust.lastRun ? (
                      <>
                        <p className="mt-1 font-mono text-xs text-foreground">
                          {formatWhen(ingestTrust.lastRun.createdAt)}
                        </p>
                        <p className="mt-1 text-xs">
                          <span className="text-label">Outcome:</span>{" "}
                          {ingestTrust.lastRun.success ? (
                            <span className="text-score-success">Completed</span>
                          ) : (
                            <span className="text-score-danger">Failed</span>
                          )}
                          {ingestTrust.lastRun.durationMs != null ? (
                            <span className="text-muted-foreground"> · {ingestTrust.lastRun.durationMs} ms</span>
                          ) : null}
                        </p>
                        {ingestTrust.lastRun.success ? (
                          <ul className="mt-2 space-y-0.5 text-[11px] leading-snug">
                            <li>
                              Fetched (after dedupe):{" "}
                              <span className="font-medium text-foreground">{ingestTrust.lastRun.fetched}</span>
                            </li>
                            <li>
                              Upsert succeeded / failed:{" "}
                              <span className="font-medium text-foreground">{ingestTrust.lastRun.succeeded}</span> /{" "}
                              <span className={ingestTrust.lastRun.failed > 0 ? "text-score-warning" : "text-foreground"}>
                                {ingestTrust.lastRun.failed}
                              </span>
                            </li>
                            <li>
                              Skipped (empty description):{" "}
                              <span className="font-medium text-foreground">{ingestTrust.lastRun.skipped}</span>
                            </li>
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-score-danger">
                            {ingestTrust.lastRun.errorMessage ?? "Unknown error"}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="mt-1 text-xs">No runs recorded yet — trigger ingest with a valid cron secret.</p>
                    )}
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-label">Last successful sync</p>
                    {ingestTrust.lastSuccess ? (
                      <>
                        <p className="mt-1 font-mono text-xs text-foreground">
                          {formatWhen(ingestTrust.lastSuccess.createdAt)}
                        </p>
                        <p className="mt-1 text-[11px]">
                          Upserts OK:{" "}
                          <span className="font-medium text-foreground">{ingestTrust.lastSuccess.succeeded}</span>
                          {ingestTrust.lastSuccess.failed > 0 ? (
                            <span className="text-score-warning"> · {ingestTrust.lastSuccess.failed} upsert errors</span>
                          ) : null}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-xs">—</p>
                    )}
                  </div>
                </div>
                {ingestTrust.lastRun?.success ? <SourceErrorsBlock raw={ingestTrust.lastRun.sourceErrors} /> : null}
                {ingestTrust.lastRun?.success && ingestTrust.lastRun.failed > 0 ? (
                  <p className="text-xs text-score-warning">
                    Last run completed but some rows failed to upsert — see server logs and{" "}
                    <span className="font-mono">upsertErrorsPreview</span> in DB for detail.
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

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
            <StatusRow
              label="FLASK_BASE_URL syntax (origin-only http/https)"
              ok={!health.flaskBaseUrlConfigured || !health.flaskUrlSyntaxError}
              detail={
                health.flaskUrlSyntaxError ??
                (!health.flaskBaseUrlConfigured
                  ? "Unset — required for APP_MODE=real pipeline calls."
                  : "Valid origin (no path/query/fragment).")
              }
            />
            <StatusRow
              label="Docker: not using loopback for cross-container calls"
              ok={!health.flaskDockerLoopbackMisconfig}
              detail={
                health.flaskDockerLoopbackMisconfig
                  ? "RUNNING_IN_DOCKER is set but FLASK_BASE_URL is localhost/127.0.0.1 — use the Flask service hostname on your Compose/K8s network."
                  : health.flaskRunningInDocker
                    ? "RUNNING_IN_DOCKER=1 — FLASK_BASE_URL is suitable for service-to-service calls."
                    : "RUNNING_IN_DOCKER unset — typical for local dev on the host; loopback FLASK_BASE_URL is OK."
              }
            />
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
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border py-3 last:border-0">
              <span className="text-sm text-muted-foreground">Flask process (GET /health)</span>
              <div className="text-right text-sm font-medium text-foreground">
                {!flaskLive.checked ? (
                  <span className="text-label">Skipped</span>
                ) : flaskLive.ok ? (
                  <span className="text-score-success">Reachable</span>
                ) : (
                  <span className="text-score-danger">Unreachable</span>
                )}
                <span className="mt-1 block text-xs font-normal text-label">{flaskLive.message}</span>
              </div>
            </div>
            {health.flaskPipelineConfigWarnings.length > 0 && (
              <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-score-warning">
                {health.flaskPipelineConfigWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            {(health.flaskPipelineBaseUrl || health.flaskUrlSyntaxError) && (
              <div className="mt-4 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                <p className="font-medium text-label">Pipeline HTTP target (server-side)</p>
                <p>
                  <span className="text-label">FLASK_BASE_URL:</span>{" "}
                  <span className="font-mono text-foreground">{health.flaskPipelineBaseUrl ?? "(invalid — see syntax row)"}</span>
                </p>
                <p>
                  <span className="text-label">Host / port:</span>{" "}
                  <span className="font-mono text-foreground">
                    {health.flaskTargetHost}:{health.flaskTargetPort ?? "—"}
                  </span>
                </p>
                {health.flaskTargetIsLoopback && (
                  <p className="text-label">
                    Loopback URL — correct when Next and Flask run on the same machine. If Next runs inside Docker,
                    set FLASK_BASE_URL to the Flask service name (e.g. http://flask:8765), not 127.0.0.1.
                  </p>
                )}
                <p className="text-label">
                  &quot;Connection refused&quot; to 127.0.0.1:8765 means nothing is listening: start Flask with{" "}
                  <code className="rounded bg-muted px-1 font-mono">python3 app.py</code> from{" "}
                  <code className="rounded bg-muted px-1 font-mono">resume-job-matcher</code>, and ensure{" "}
                  <code className="rounded bg-muted px-1 font-mono">PORT</code> in Flask&apos;s{" "}
                  <code className="rounded bg-muted px-1 font-mono">.env</code> matches this port.
                </p>
              </div>
            )}
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
