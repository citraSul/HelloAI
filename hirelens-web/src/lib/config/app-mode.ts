import { parseFlaskBaseUrl } from "@/lib/flask/url-validation";

/**
 * Single source of truth for local vs pipeline-backed behavior.
 *
 * - mock: deterministic mocks for match / tailor / impact — no Flask required.
 * - real: expects Python Flask pipeline + env; misconfiguration surfaces as errors.
 */
export type AppMode = "mock" | "real";

export function getAppMode(): AppMode {
  const raw = process.env.APP_MODE?.trim().toLowerCase();
  if (raw === "mock" || raw === "real") return raw;
  return "mock";
}

export function isMockMode(): boolean {
  return getAppMode() === "mock";
}

export function isRealMode(): boolean {
  return getAppMode() === "real";
}

/** True when FLASK_BASE_URL + HIRELENS_INTERNAL_API_KEY are both set (pipeline HTTP calls allowed in REAL mode). */
export function isFlaskEnvConfigured(): boolean {
  const url = process.env.FLASK_BASE_URL?.trim();
  const key = process.env.HIRELENS_INTERNAL_API_KEY?.trim();
  return Boolean(url && key);
}

/**
 * In REAL mode, pipeline must be configured; otherwise scoring/tailor/impact throw with a clear message.
 * Also validates FLASK_BASE_URL shape (origin-only http/https) when set.
 */
export function assertRealModePipelineConfigured(): void {
  if (!isRealMode()) return;
  if (!isFlaskEnvConfigured()) {
    throw new Error(
      "APP_MODE=real requires FLASK_BASE_URL and HIRELENS_INTERNAL_API_KEY. Set them in .env.local or use APP_MODE=mock for local development without Flask.",
    );
  }
  const raw = process.env.FLASK_BASE_URL?.trim() ?? "";
  const p = parseFlaskBaseUrl(raw);
  if (!p.ok) {
    throw new Error(`APP_MODE=real: invalid FLASK_BASE_URL — ${p.message}`);
  }
}

export function getAppModeLabel(): string {
  return getAppMode().toUpperCase();
}
