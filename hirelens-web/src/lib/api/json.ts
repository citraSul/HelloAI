import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isFlaskPipelineError } from "@/lib/flask/pipeline-error";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function jsonFromZod(e: ZodError) {
  return jsonError("Validation failed", 422, e.flatten());
}

/**
 * Maps service-layer errors to HTTP responses. Uses 503 for Flask network failures.
 */
export function jsonFromServiceError(e: unknown, notFoundHint = "not found") {
  if (isFlaskPipelineError(e)) {
    return jsonError(e.message, e.suggestedStatus(), {
      flask: {
        kind: e.kind,
        operation: e.operation,
        url: e.url,
        attempts: e.attempts,
        causeCode: e.causeCode ?? null,
      },
    });
  }
  console.error(e);
  const msg = e instanceof Error ? e.message : "Request failed";
  const status = msg.toLowerCase().includes(notFoundHint.toLowerCase()) ? 404 : 500;
  return jsonError(msg, status);
}
