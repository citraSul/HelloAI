import { getAppMode } from "@/lib/config/app-mode";
import {
  getFlaskConnectionInfoFromEnv,
  parseFlaskBaseUrl,
  type FlaskConnectionInfo,
} from "@/lib/flask/url-validation";

export type { FlaskConnectionInfo };
export { parseFlaskBaseUrl } from "@/lib/flask/url-validation";

const DEFAULT_FETCH_TIMEOUT_MS = 45_000;
const DEFAULT_FETCH_MAX_RETRIES = 2;

/** Set to 1/true in Dockerfiles for the Next.js image — enables loopback URL warnings. */
export function isNextRunningInDocker(): boolean {
  const v = process.env.RUNNING_IN_DOCKER?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** True when Next.js should call the Python Flask pipeline instead of mocks. */
export function isFlaskPipelineEnabled(): boolean {
  if (getAppMode() === "mock") return false;
  const url = process.env.FLASK_BASE_URL?.trim();
  const key = process.env.HIRELENS_INTERNAL_API_KEY?.trim();
  return Boolean(url && key);
}

export function getFlaskBaseUrl(): string {
  return (process.env.FLASK_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
}

/** Per-attempt timeout for Flask `fetch` (AbortController). */
export function getFlaskFetchTimeoutMs(): number {
  const raw = process.env.FLASK_FETCH_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_FETCH_TIMEOUT_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1_000 && n <= 120_000 ? Math.floor(n) : DEFAULT_FETCH_TIMEOUT_MS;
}

/** Retries after the first attempt (exponential backoff in server-fetch). Max 5. */
export function getFlaskFetchMaxRetries(): number {
  const raw = process.env.FLASK_FETCH_MAX_RETRIES?.trim();
  if (!raw) return DEFAULT_FETCH_MAX_RETRIES;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 && n <= 5 ? n : DEFAULT_FETCH_MAX_RETRIES;
}

/**
 * What the Next.js server will call for pipeline HTTP (from FLASK_BASE_URL).
 * Returns null if unset or invalid.
 */
export function getFlaskConnectionInfo(): FlaskConnectionInfo | null {
  return getFlaskConnectionInfoFromEnv();
}

/** Full config health for diagnostics and startup (single source of truth). */
export type FlaskPipelineConfigHealth = {
  runningInDocker: boolean;
  dockerLoopbackMisconfig: boolean;
  urlSyntaxError: string | null;
  normalizedBaseUrl: string | null;
  connectionInfo: FlaskConnectionInfo | null;
  pipelineConfigWarnings: string[];
};

export function getFlaskPipelineConfigHealth(): FlaskPipelineConfigHealth {
  const runningInDocker = isNextRunningInDocker();
  const raw = (process.env.FLASK_BASE_URL || "").trim();
  const pipelineWarnings: string[] = [];

  if (!raw) {
    return {
      runningInDocker,
      dockerLoopbackMisconfig: false,
      urlSyntaxError: null,
      normalizedBaseUrl: null,
      connectionInfo: null,
      pipelineConfigWarnings: [],
    };
  }

  const parsed = parseFlaskBaseUrl(raw);
  if (!parsed.ok) {
    return {
      runningInDocker,
      dockerLoopbackMisconfig: false,
      urlSyntaxError: parsed.message,
      normalizedBaseUrl: null,
      connectionInfo: null,
      pipelineConfigWarnings: [parsed.message],
    };
  }

  const dockerLoopbackMisconfig = runningInDocker && parsed.info.isLoopback;
  if (dockerLoopbackMisconfig) {
    pipelineWarnings.push(
      "RUNNING_IN_DOCKER is set but FLASK_BASE_URL uses localhost/127.0.0.1 — from inside a container that points to this container, not Flask. Set FLASK_BASE_URL to your Flask service hostname (e.g. http://hirelens-flask:8765).",
    );
  }

  return {
    runningInDocker,
    dockerLoopbackMisconfig,
    urlSyntaxError: null,
    normalizedBaseUrl: parsed.baseUrl,
    connectionInfo: parsed.info,
    pipelineConfigWarnings: pipelineWarnings,
  };
}

export function validateFlaskBaseUrlForPipeline():
  | { ok: true; baseUrl: string }
  | { ok: false; message: string } {
  const raw = (process.env.FLASK_BASE_URL || "").trim();
  if (!raw) return { ok: false, message: "FLASK_BASE_URL is empty" };
  const p = parseFlaskBaseUrl(raw);
  if (!p.ok) return { ok: false, message: p.message };
  return { ok: true, baseUrl: p.baseUrl };
}
