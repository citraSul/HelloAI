import {
  getFlaskPipelineConfigHealth,
  isFlaskPipelineEnabled,
  validateFlaskBaseUrlForPipeline,
} from "@/lib/flask/env";

/**
 * GET /health against FLASK_BASE_URL when the pipeline is enabled.
 * Logs actionable errors if URL is invalid, Docker+loopback is misconfigured, or Flask is unreachable.
 */
export async function runFlaskHealthPreflight(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!isFlaskPipelineEnabled()) return;

  const cfg = getFlaskPipelineConfigHealth();
  if (cfg.dockerLoopbackMisconfig) {
    console.error(
      "[hirelens] FLASK CONFIG (blocking in Docker): RUNNING_IN_DOCKER is set but FLASK_BASE_URL uses 127.0.0.1/localhost.",
      "From inside a container that targets the container itself, not the Flask process. Set FLASK_BASE_URL=http://<flask-service>:<port> on the Docker network.",
    );
  }

  const validated = validateFlaskBaseUrlForPipeline();
  if (!validated.ok) {
    console.error("[hirelens] FLASK_BASE_URL invalid — pipeline HTTP calls will fail.", validated.message);
    return;
  }

  const url = `${validated.baseUrl}/health`;
  const rawTimeout = process.env.FLASK_STARTUP_HEALTH_TIMEOUT_MS?.trim();
  const parsed = rawTimeout ? parseInt(rawTimeout, 10) : 5_000;
  const timeoutMs = Math.min(8_000, Math.max(1_000, Number.isFinite(parsed) ? parsed : 5_000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn("[hirelens] Flask preflight: GET /health returned HTTP", res.status, "—", url);
      return;
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const svc =
      body && typeof body === "object" && body !== null && "service" in body
        ? String((body as { service?: string }).service ?? "")
        : "";
    console.info("[hirelens] Flask preflight OK", { url, service: svc || "unknown" });
  } catch (e: unknown) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    const localHint =
      " Fix: start Flask — cd resume-job-matcher && python3 app.py — and align PORT in resume-job-matcher/.env with the port in FLASK_BASE_URL (default 8765).";
    const dockerHint = cfg.runningInDocker && cfg.dockerLoopbackMisconfig ? " Also fix loopback FLASK_BASE_URL for Docker (see logs above)." : "";
    console.warn(
      "[hirelens] Flask preflight FAILED — pipeline routes will return 503 until /health succeeds." + localHint + dockerHint,
      { url, error: msg },
    );
  }
}
