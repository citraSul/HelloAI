import { getPrismaUserMessage, isMissingTableError } from "@/lib/db/prisma-errors";

/**
 * Runs once when the Node server starts (not in Edge).
 * Surfaces schema/DB issues early in development instead of failing mid-request.
 */
export async function register() {
  if (process.env.NODE_ENV !== "development") return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { prisma } = await import("@/lib/db/prisma");

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    console.warn(
      "[hirelens] Dev: database unreachable —",
      getPrismaUserMessage(e),
    );
    return;
  }

  try {
    await prisma.decisionAnalysis.count();
  } catch (e) {
    if (isMissingTableError(e)) {
      console.warn(
        "[hirelens] Dev: DecisionAnalysis table missing — decision persistence will fail until you run `npm run db:push` and restart.\n",
        getPrismaUserMessage(e),
      );
    } else {
      console.warn("[hirelens] Dev: schema check warning —", getPrismaUserMessage(e));
    }
  }

  try {
    await prisma.applicationOutcome.count();
  } catch (e) {
    if (isMissingTableError(e)) {
      console.warn(
        "[hirelens] Dev: ApplicationOutcome table missing — run `npm run db:push` for outcome tracking.\n",
        getPrismaUserMessage(e),
      );
    }
  }
}
