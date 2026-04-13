/**
 * Strict validation/parsing for FLASK_BASE_URL (no app-mode import — safe from circular deps).
 * Single source of truth for origin shape: http(s)://host[:port] with path / only.
 */

export type FlaskConnectionInfo = {
  baseUrl: string;
  host: string;
  port: string;
  isLoopback: boolean;
};

type ParseFlaskUrlResult =
  | { ok: true; baseUrl: string; url: URL; info: FlaskConnectionInfo }
  | { ok: false; message: string };

/**
 * Strict parse of FLASK_BASE_URL: origin only (no path, query, or fragment).
 */
export function parseFlaskBaseUrl(raw: string): ParseFlaskUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: "FLASK_BASE_URL is empty" };
  const baseUrl = trimmed.replace(/\/$/, "");
  let u: URL;
  try {
    u = new URL(baseUrl);
  } catch {
    return { ok: false, message: "FLASK_BASE_URL is not a valid URL" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, message: "FLASK_BASE_URL must start with http:// or https://" };
  }
  if (!u.hostname) return { ok: false, message: "FLASK_BASE_URL must include a host" };
  if (u.pathname !== "/") {
    return {
      ok: false,
      message:
        "FLASK_BASE_URL must be an origin only (no path). Example: http://127.0.0.1:8765 — not http://host:8765/api",
    };
  }
  if (u.search || u.hash) {
    return { ok: false, message: "FLASK_BASE_URL must not include query or fragment" };
  }
  const host = u.hostname;
  const port = u.port || (u.protocol === "https:" ? "443" : u.protocol === "http:" ? "80" : "");
  const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "::1";
  return {
    ok: true,
    baseUrl,
    url: u,
    info: { baseUrl, host, port, isLoopback },
  };
}

export function getFlaskConnectionInfoFromEnv(): FlaskConnectionInfo | null {
  const raw = (process.env.FLASK_BASE_URL || "").trim();
  if (!raw) return null;
  const p = parseFlaskBaseUrl(raw);
  return p.ok ? p.info : null;
}
