-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ApplicationOutcomeStatus" AS ENUM ('saved', 'applied', 'responded', 'interviewed', 'offered', 'rejected', 'archived');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParsedResumeProfile" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParsedResumeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "rawDescription" TEXT NOT NULL,
    "analyzedJson" JSONB,
    "source" TEXT,
    "externalId" TEXT,
    "applyUrl" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "verdict" TEXT NOT NULL,
    "breakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TailoredResume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TailoredResume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tailoredResumeId" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpactMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "tailoredResumeId" TEXT,
    "matchAnalysisId" TEXT,
    "impactMetricId" TEXT,
    "recommendation" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "decisionScore" DOUBLE PRECISION,
    "reasons" JSONB NOT NULL,
    "risks" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationOutcome" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "tailoredResumeId" TEXT,
    "decisionAnalysisId" TEXT,
    "status" "ApplicationOutcomeStatus" NOT NULL DEFAULT 'saved',
    "appliedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "interviewedAt" TIMESTAMP(3),
    "offeredAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "source" TEXT DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "inputJson" JSONB NOT NULL,
    "outputJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ParsedResumeProfile_resumeId_key" ON "ParsedResumeProfile"("resumeId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_userId_source_externalId_key" ON "Job"("userId", "source", "externalId");

-- CreateIndex
CREATE INDEX "MatchAnalysis_userId_idx" ON "MatchAnalysis"("userId");

-- CreateIndex
CREATE INDEX "MatchAnalysis_resumeId_jobId_idx" ON "MatchAnalysis"("resumeId", "jobId");

-- CreateIndex
CREATE INDEX "ImpactMetric_userId_idx" ON "ImpactMetric"("userId");

-- CreateIndex
CREATE INDEX "DecisionAnalysis_userId_idx" ON "DecisionAnalysis"("userId");

-- CreateIndex
CREATE INDEX "DecisionAnalysis_jobId_resumeId_idx" ON "DecisionAnalysis"("jobId", "resumeId");

-- CreateIndex
CREATE INDEX "ApplicationOutcome_userId_idx" ON "ApplicationOutcome"("userId");

-- CreateIndex
CREATE INDEX "ApplicationOutcome_jobId_idx" ON "ApplicationOutcome"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationOutcome_userId_jobId_resumeId_key" ON "ApplicationOutcome"("userId", "jobId", "resumeId");

-- CreateIndex
CREATE INDEX "AgentRun_userId_idx" ON "AgentRun"("userId");

-- CreateIndex
CREATE INDEX "AgentRun_agentName_idx" ON "AgentRun"("agentName");

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParsedResumeProfile" ADD CONSTRAINT "ParsedResumeProfile_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchAnalysis" ADD CONSTRAINT "MatchAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchAnalysis" ADD CONSTRAINT "MatchAnalysis_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchAnalysis" ADD CONSTRAINT "MatchAnalysis_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailoredResume" ADD CONSTRAINT "TailoredResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailoredResume" ADD CONSTRAINT "TailoredResume_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailoredResume" ADD CONSTRAINT "TailoredResume_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactMetric" ADD CONSTRAINT "ImpactMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactMetric" ADD CONSTRAINT "ImpactMetric_tailoredResumeId_fkey" FOREIGN KEY ("tailoredResumeId") REFERENCES "TailoredResume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionAnalysis" ADD CONSTRAINT "DecisionAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionAnalysis" ADD CONSTRAINT "DecisionAnalysis_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionAnalysis" ADD CONSTRAINT "DecisionAnalysis_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionAnalysis" ADD CONSTRAINT "DecisionAnalysis_matchAnalysisId_fkey" FOREIGN KEY ("matchAnalysisId") REFERENCES "MatchAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionAnalysis" ADD CONSTRAINT "DecisionAnalysis_impactMetricId_fkey" FOREIGN KEY ("impactMetricId") REFERENCES "ImpactMetric"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionAnalysis" ADD CONSTRAINT "DecisionAnalysis_tailoredResumeId_fkey" FOREIGN KEY ("tailoredResumeId") REFERENCES "TailoredResume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationOutcome" ADD CONSTRAINT "ApplicationOutcome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationOutcome" ADD CONSTRAINT "ApplicationOutcome_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationOutcome" ADD CONSTRAINT "ApplicationOutcome_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationOutcome" ADD CONSTRAINT "ApplicationOutcome_tailoredResumeId_fkey" FOREIGN KEY ("tailoredResumeId") REFERENCES "TailoredResume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationOutcome" ADD CONSTRAINT "ApplicationOutcome_decisionAnalysisId_fkey" FOREIGN KEY ("decisionAnalysisId") REFERENCES "DecisionAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

