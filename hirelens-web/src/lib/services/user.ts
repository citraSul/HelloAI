import { prisma } from "@/lib/db/prisma";

const DEMO_EMAIL = "demo@hirelens.local";

export async function getOrCreateDemoUser() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) return existing;
  return prisma.user.create({
    data: { email: DEMO_EMAIL, name: "Demo User" },
  });
}

export async function resolveUserId(explicit?: string) {
  if (explicit) {
    const u = await prisma.user.findUnique({ where: { id: explicit } });
    if (u) return u.id;
  }
  const demo = await getOrCreateDemoUser();
  return demo.id;
}
