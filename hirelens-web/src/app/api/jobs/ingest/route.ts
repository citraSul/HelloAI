import { timingSafeEqual } from "node:crypto";
import { jsonError, jsonOk } from "@/lib/api/json";
import { syncJobsFromFeeds } from "@/lib/jobs/sync-feed";

function getCronToken(request: Request): string {
  const hdr =
    request.headers.get("x-cron-secret")?.trim() ||
    request.headers.get("X-Cron-Secret")?.trim() ||
    "";
  const auth = request.headers.get("authorization")?.trim() || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return hdr;
}

function cronSecretMatches(expected: string, provided: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return jsonError("Job ingest is not configured (CRON_SECRET missing)", 503);
  }

  const token = getCronToken(request);
  if (!cronSecretMatches(expected, token)) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const summary = await syncJobsFromFeeds();
    return jsonOk(summary);
  } catch (e) {
    console.error("[api/jobs/ingest] sync failed:", e);
    const message = e instanceof Error ? e.message : "Sync failed";
    return jsonError(message, 500);
  }
}

/** Reject other methods explicitly. */
export function GET() {
  return jsonError("Method not allowed", 405);
}

export function PUT() {
  return jsonError("Method not allowed", 405);
}

export function PATCH() {
  return jsonError("Method not allowed", 405);
}

export function DELETE() {
  return jsonError("Method not allowed", 405);
}
