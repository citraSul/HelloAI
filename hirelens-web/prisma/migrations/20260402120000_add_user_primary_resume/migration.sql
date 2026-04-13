-- AlterTable
ALTER TABLE "User" ADD COLUMN "primaryResumeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_primaryResumeId_key" ON "User"("primaryResumeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_primaryResumeId_fkey" FOREIGN KEY ("primaryResumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;
