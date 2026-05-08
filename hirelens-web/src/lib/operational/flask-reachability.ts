import { isFlaskPipelineEnabled, validateFlaskBaseUrlForPipeline } from "@/lib/flask/env";

export type FlaskReachabilitySnapshot = {
  checked: boolean;
  ok: boolean | null;
  httpStatus?: number;
  message: string;
};

/**
 * Live GET /health against FLASK_BASE_URL when the pipeline is enabled (same idea as startup preflight).
 * For diagnostics only — does not change pipeline behavior.
 */
export async function probeFlaskHealthForDiagnostics(): Promise<FlaskReachabilitySnapshot> {
  if (!isFlaskPipelineEnabled()) {
    return {
      checked: false,
      ok: null,
      message:
        "Pipeline not active (APP_MODE=mock or missing FLASK_BASE_URL / HIRELENS_INTERNAL_API_KEY) — Flask reachability not checked.",
    };
  }

  const v = validateFlaskBaseUrlForPipeline();
  if (!v.ok) {
    return { checked: false, ok: false, message: v.message };
  }

  const url = `${v.baseUrl}/health`;
  const controller = new AbortController();
  const timeoutMs = 4_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (res.ok) {
      return { checked: true, ok: true, httpStatus: res.status, message: `GET /health OK (${res.status})` };
    }
    return {
      checked: true,
      ok: false,
      httpStatus: res.status,
      message: `GET /health returned HTTP ${res.status} — check Flask logs and FLASK_BASE_URL.`,
    };
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    return {
      checked: true,
      ok: false,
      message:
        msg === "This operation was aborted"
          ? `GET /health timed out after ${timeoutMs}ms — ${url}`
          : `${msg} — ${url}`,
    };
  }
}
