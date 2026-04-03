/**
 * Opt-in server logs for local real-pipeline validation.
 * Set `HIRELENS_PIPELINE_DEBUG=1` in `.env.local` — never enable in production.
 */
const MAX_JSON = 12_000;

export function isPipelineDebugEnabled(): boolean {
  return process.env.HIRELENS_PIPELINE_DEBUG?.trim() === "1";
}

export function logPipelineDebug(
  stage: "match" | "tailor" | "impact" | "decision",
  payload: Record<string, unknown>,
): void {
  if (!isPipelineDebugEnabled()) return;
  try {
    const s = JSON.stringify(payload);
    const out = s.length > MAX_JSON ? `${s.slice(0, MAX_JSON)}…[truncated]` : s;
    console.log(`[HireLens][pipeline-debug][${stage}]`, out);
  } catch {
    console.log(`[HireLens][pipeline-debug][${stage}]`, "(payload not serializable)");
  }
}
