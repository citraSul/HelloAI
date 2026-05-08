import { prisma } from "@/lib/db/prisma";

const DEMO_EMAIL = "demo@hirelens.local";

/** Dev / e2e: shared user when no session (see `ALLOW_ANONYMOUS_DEMO`). */
export async function getOrCreateDemoUser() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) return existing;
  return prisma.user.create({
    data: { email: DEMO_EMAIL, name: "Demo User" },
  });
}

/**
 * Authenticated user id, optional ingest service account, or demo (when `ALLOW_ANONYMOUS_DEMO=1`).
 * Returns null when there is no valid identity (API handlers should respond 401).
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  const ingestAs = process.env.INGEST_ACT_AS_USER_ID?.trim();
  if (ingestAs) {
    const u = await prisma.user.findUnique({ where: { id: ingestAs }, select: { id: true } });
    if (u) return u.id;
  }

  if (process.env.ALLOW_ANONYMOUS_DEMO === "1") {
    const demo = await getOrCreateDemoUser();
    return demo.id;
  }

  return null;
}

/** @throws Error with message `Unauthorized` when no identity can be resolved */
export async function resolveUserId(): Promise<string> {
  const id = await getAuthenticatedUserId();
  if (!id) throw new Error("Unauthorized");
  return id;
}
