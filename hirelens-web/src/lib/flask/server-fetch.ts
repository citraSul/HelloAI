import { FlaskPipelineError, type FlaskFailureKind } from "@/lib/flask/pipeline-error";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attemptIndex: number): number {
  return Math.min(30_000, 200 * 2 ** attemptIndex);
}

/** Best-effort: Node/undici attach codes on error.cause. */
export function extractNetworkErrorCode(err: unknown): string | undefined {
  if (err === null || err === undefined) return undefined;
  if (typeof err !== "object") return undefined;
  const e = err as { code?: string; cause?: unknown; name?: string };
  if (typeof e.code === "string" && e.code.length > 0) return e.code;
  if (e.cause && typeof e.cause === "object" && e.cause !== null) {
    const c = e.cause as { code?: string };
    if (typeof c.code === "string" && c.code.length > 0) return c.code;
  }
  if (e.name === "AbortError") return "ETIMEDOUT";
  return undefined;
}

/**
 * Maps low-level Node/undici errors to operator-facing text (also used in tests).
 * Always includes host/context so bare "fetch failed" never reaches the UI alone.
 */
export function describeFlaskNetworkFailure(url: string, code: string | undefined, rawMessage: string): string {
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();
  if (code === "ECONNREFUSED" || rawMessage.includes("ECONNREFUSED")) {
    return `Connection refused to ${host} — is the Flask service running and listening on the expected port?`;
  }
  if (code === "ENOTFOUND" || rawMessage.includes("ENOTFOUND")) {
    return `DNS lookup failed for Flask host (${host}) — check FLASK_BASE_URL (use the Docker service name from inside containers, not localhost).`;
  }
  if (code === "EAI_AGAIN" || rawMessage.includes("EAI_AGAIN")) {
    return `Temporary DNS failure (${host}) — retry or check resolver / FLASK_BASE_URL.`;
  }
  if (code === "ENETUNREACH" || rawMessage.includes("ENETUNREACH")) {
    return `No route to host (${host}) — check network routing and FLASK_BASE_URL.`;
  }
  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT" || rawMessage.includes("AbortError")) {
    return `Request to ${host} timed out — check network, firewall, and FLASK_FETCH_TIMEOUT_MS.`;
  }
  if (code === "ECONNRESET" || code === "EPIPE") {
    return `Connection to ${host} was reset — upstream closed the socket.`;
  }
  return `Network error to ${host} (${code ?? "no code"}): ${rawMessage}`;
}

export type FlaskFetchJsonOptions = {
  operation: string;
  url: string;
  init: RequestInit;
  timeoutMs: number;
  maxRetries: number;
};

export type FlaskFetchJsonResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: FlaskPipelineError };

/**
 * POST/GET JSON to Flask with per-attempt timeout, retries on transient failures,
 * and structured errors (no silent "fetch failed").
 */
export async function flaskFetchJson<T>(opts: FlaskFetchJsonOptions): Promise<FlaskFetchJsonResult<T>> {
  const { operation, url, init, timeoutMs, maxRetries } = opts;
  const attemptsTotal = maxRetries + 1;
  let lastNetworkCode: string | undefined;
  let attemptsUsed = 0;

  for (let attempt = 0; attempt < attemptsTotal; attempt++) {
    attemptsUsed = attempt + 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const transient =
        res.status === 502 || res.status === 503 || res.status === 504 || res.status === 429 || res.status === 408;
      if (transient && attempt < maxRetries) {
        await res.text().catch(() => undefined);
        console.warn("[HireLens] Flask upstream transient — retrying", {
          operation,
          url,
          status: res.status,
          attempt: attempt + 1,
          maxAttempts: attemptsTotal,
          nextDelayMs: backoffMs(attempt),
        });
        await sleep(backoffMs(attempt));
        continue;
      }

      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = text.length ? JSON.parse(text) : {};
      } catch (parseErr) {
        console.error("[HireLens] Flask non-JSON response", {
          operation,
          url,
          status: res.status,
          bodyPrefix: text.slice(0, 500),
        });
        return {
          ok: false,
          error: new FlaskPipelineError(
            `Flask returned non-JSON (${res.status}) at ${operation}`,
            {
              kind: "parse",
              operation,
              url,
              httpStatus: res.status,
              attempts: attemptsUsed,
              cause: parseErr,
            },
          ),
        };
      }

      if (!res.ok) {
        const body = parsed as { message?: string; ok?: boolean };
        const msg = typeof body.message === "string" ? body.message : `HTTP ${res.status}`;
        console.error("[HireLens] Flask HTTP error response", {
          operation,
          url,
          status: res.status,
          message: msg.slice(0, 300),
        });
        return {
          ok: false,
          error: new FlaskPipelineError(`${operation}: ${msg}`, {
            kind: "upstream",
            operation,
            url,
            httpStatus: res.status,
            attempts: attemptsUsed,
          }),
        };
      }

      return { ok: true, data: parsed as T, status: res.status };
    } catch (err: unknown) {
      clearTimeout(timer);
      lastNetworkCode = extractNetworkErrorCode(err);
      const raw = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries) {
        console.warn("[HireLens] Flask network error — retrying", {
          operation,
          url,
          attempt: attempt + 1,
          maxAttempts: attemptsTotal,
          code: lastNetworkCode ?? null,
          message: raw,
          nextDelayMs: backoffMs(attempt),
        });
        await sleep(backoffMs(attempt));
        continue;
      }

      const msg = describeFlaskNetworkFailure(url, lastNetworkCode, raw);
      console.error("[HireLens] Flask network failure (giving up)", {
        operation,
        url,
        attempts: attemptsUsed,
        code: lastNetworkCode ?? null,
        message: raw,
      });
      const kind: FlaskFailureKind = "network";
      return {
        ok: false,
        error: new FlaskPipelineError(msg, {
          kind,
          operation,
          url,
          causeCode: lastNetworkCode,
          attempts: attemptsUsed,
          cause: err instanceof Error ? err : undefined,
        }),
      };
    }
  }

  throw new Error("[HireLens] flaskFetchJson: exhausted attempts without result (bug)");
}
