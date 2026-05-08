-- CreateEnum
CREATE TYPE "IdentityTokenKind" AS ENUM ('password_reset', 'email_verify');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "IdentityToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "IdentityTokenKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdentityToken_tokenHash_kind_idx" ON "IdentityToken"("tokenHash", "kind");

-- CreateIndex
CREATE INDEX "IdentityToken_userId_kind_idx" ON "IdentityToken"("userId", "kind");

-- AddForeignKey
ALTER TABLE "IdentityToken" ADD CONSTRAINT "IdentityToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grandfather existing password accounts (avoid forced re-verify on deploy)
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "passwordHash" IS NOT NULL AND "emailVerifiedAt" IS NULL;
