/**
 * Typed errors from the Flask HTTP layer so API routes can map to HTTP status
 * and logs stay structured (network vs HTTP vs parse vs upstream business logic).
 */
export type FlaskFailureKind = "network" | "http" | "parse" | "upstream";

export class FlaskPipelineError extends Error {
  readonly kind: FlaskFailureKind;
  readonly operation: string;
  readonly url: string;
  /** Node / undici error code when known (e.g. ECONNREFUSED, ENOTFOUND). */
  readonly causeCode?: string;
  readonly httpStatus?: number;
  readonly attempts: number;

  constructor(
    message: string,
    opts: {
      kind: FlaskFailureKind;
      operation: string;
      url: string;
      causeCode?: string;
      httpStatus?: number;
      attempts: number;
      cause?: unknown;
    },
  ) {
    super(message, opts.cause instanceof Error ? { cause: opts.cause } : undefined);
    this.name = "FlaskPipelineError";
    this.kind = opts.kind;
    this.operation = opts.operation;
    this.url = opts.url;
    this.causeCode = opts.causeCode;
    this.httpStatus = opts.httpStatus;
    this.attempts = opts.attempts;
  }

  /** Suggested status for JSON API routes (Next Route Handlers). */
  suggestedStatus(): number {
    if (this.kind === "network") return 503;
    if (this.kind === "parse") return 502;
    if (this.kind === "upstream" && this.httpStatus === 401) return 502;
    if (this.kind === "upstream" && this.httpStatus === 403) return 502;
    if (this.kind === "http") return this.httpStatus ?? 502;
    return 502;
  }
}

export function isFlaskPipelineError(e: unknown): e is FlaskPipelineError {
  return e instanceof FlaskPipelineError;
}
