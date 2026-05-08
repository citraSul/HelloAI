import { createHash, randomBytes } from "node:crypto";
import type { IdentityTokenKind } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const B32 = 32;

export function hashIdentityToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function generateRawIdentityToken(): string {
  return randomBytes(B32).toString("base64url");
}

export async function createIdentityToken(
  userId: string,
  kind: IdentityTokenKind,
  ttlMs: number,
): Promise<string> {
  const raw = generateRawIdentityToken();
  const tokenHash = hashIdentityToken(raw);
  const expiresAt = new Date(Date.now() + ttlMs);

  if (kind === "password_reset") {
    await prisma.identityToken.deleteMany({ where: { userId, kind: "password_reset" } });
  }
  if (kind === "email_verify") {
    await prisma.identityToken.deleteMany({ where: { userId, kind: "email_verify" } });
  }

  await prisma.identityToken.create({
    data: { userId, kind, tokenHash, expiresAt },
  });
  return raw;
}

export async function consumeIdentityToken(
  raw: string,
  kind: IdentityTokenKind,
): Promise<{ userId: string } | null> {
  const tokenHash = hashIdentityToken(raw);
  return prisma.$transaction(async (tx) => {
    const row = await tx.identityToken.findFirst({
      where: {
        tokenHash,
        kind,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!row) return null;
    const upd = await tx.identityToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (upd.count !== 1) return null;
    return { userId: row.userId };
  });
}
