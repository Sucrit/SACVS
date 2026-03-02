-- CreateEnum
CREATE TYPE "AiDecision" AS ENUM ('PENDING', 'CLEAR', 'REVIEW_REQUIRED', 'BLOCK', 'FAILED');

-- CreateEnum
CREATE TYPE "AiReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "FraudAnalysisJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "FraudLabel" AS ENUM ('CLEAN', 'FRAUD', 'UNSURE');

-- CreateEnum
CREATE TYPE "FraudLabelSource" AS ENUM ('INSTITUTION', 'ADMIN');

-- AlterTable
ALTER TABLE "Credential"
ADD COLUMN "aiDecision" "AiDecision",
ADD COLUMN "aiReviewStatus" "AiReviewStatus",
ADD COLUMN "aiModel" TEXT,
ADD COLUMN "aiModelVersion" TEXT,
ADD COLUMN "aiSignals" JSONB,
ADD COLUMN "aiReviewedById" TEXT,
ADD COLUMN "aiReviewedAt" TIMESTAMP(3),
ADD COLUMN "aiOverrideReason" TEXT;

-- CreateTable
CREATE TABLE "FraudAnalysisJob" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "status" "FraudAnalysisJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "payload" JSONB,

    CONSTRAINT "FraudAnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudReviewLabel" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "reviewedById" TEXT NOT NULL,
    "label" "FraudLabel" NOT NULL,
    "source" "FraudLabelSource" NOT NULL,
    "notes" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FraudReviewLabel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Credential_aiDecision_status_idx" ON "Credential"("aiDecision", "status");

-- CreateIndex
CREATE INDEX "FraudAnalysisJob_status_requestedAt_idx" ON "FraudAnalysisJob"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "FraudAnalysisJob_credentialId_idx" ON "FraudAnalysisJob"("credentialId");

-- CreateIndex
CREATE INDEX "FraudReviewLabel_label_reviewedAt_idx" ON "FraudReviewLabel"("label", "reviewedAt");

-- CreateIndex
CREATE INDEX "FraudReviewLabel_credentialId_idx" ON "FraudReviewLabel"("credentialId");

-- CreateIndex
CREATE INDEX "FraudReviewLabel_reviewedById_idx" ON "FraudReviewLabel"("reviewedById");

-- AddForeignKey
ALTER TABLE "FraudAnalysisJob" ADD CONSTRAINT "FraudAnalysisJob_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudReviewLabel" ADD CONSTRAINT "FraudReviewLabel_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudReviewLabel" ADD CONSTRAINT "FraudReviewLabel_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;