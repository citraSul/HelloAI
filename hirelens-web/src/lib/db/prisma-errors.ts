/**
 * Maps Prisma / DB errors to actionable dev-facing messages.
 * Does not expose secrets; keeps raw details out of API responses where possible.
 */

const DB_PUSH_HINT = "From the hirelens-web directory run: npm run db:push";
const RESTART_HINT = "Stop the dev server (Ctrl+C), then run: npm run dev:clean";

/** Prisma error codes we handle explicitly. */
export function getPrismaErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const c = (error as { code?: string }).code;
    return typeof c === "string" ? c : undefined;
  }
  return undefined;
}

export function isMissingTableError(error: unknown): boolean {
  const code = getPrismaErrorCode(error);
  if (code === "P2021" || code === "P2010") return true;
  const msg = error instanceof Error ? error.message : String(error);
  return /does not exist in the current database/i.test(msg) || /relation .* does not exist/i.test(msg);
}

export function isStaleNextBuildError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /Cannot find module '\.\/[\d]+\.js'/.test(msg) || /Cannot find module '\.\/chunks\//.test(msg);
}

/**
 * User- and log-friendly message for API responses and console.warn.
 */
export function getPrismaUserMessage(error: unknown): string {
  if (isStaleNextBuildError(error)) {
    return `Stale or corrupt Next.js build (.next). ${RESTART_HINT}`;
  }
  if (isMissingTableError(error)) {
    return `Required database table is missing or schema is not applied. ${DB_PUSH_HINT}. Then restart the dev server.`;
  }
  const code = getPrismaErrorCode(error);
  if (code === "P1001" || code === "P1000") {
    return "Cannot reach the database — check DATABASE_URL and that PostgreSQL is running.";
  }
  if (code === "P1017") {
    return "Database server closed the connection — retry or check DB health.";
  }
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("prisma.") && msg.includes("undefined") && msg.includes("create")) {
    return `Prisma client is out of sync with the schema (stale dev server). ${RESTART_HINT}`;
  }
  if (msg.includes("prisma.") && msg.includes("undefined") && msg.includes("count")) {
    return `Prisma client is out of sync with the schema (stale dev server). ${RESTART_HINT}`;
  }
  return msg.length > 400 ? `${msg.slice(0, 400)}…` : msg;
}

export function getTableCheckUserMessage(tableName: string, error: unknown): string {
  if (isMissingTableError(error)) {
    return `${tableName}: table missing — ${DB_PUSH_HINT}`;
  }
  return getPrismaUserMessage(error);
}
