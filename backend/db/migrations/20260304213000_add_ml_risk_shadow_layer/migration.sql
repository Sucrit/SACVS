CREATE TYPE "RiskBand" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "RiskReviewStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED_ABUSE', 'BENIGN', 'UNCERTAIN');
CREATE TYPE "RiskModelType" AS ENUM ('SUPERVISED', 'ANOMALY', 'ENSEMBLE');

CREATE TABLE "RiskModelVersion" (
  "id" TEXT NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "modelType" "RiskModelType" NOT NULL,
  "description" TEXT,
  "featureSchema" JSONB,
  "metrics" JSONB,
  "artifactPath" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RiskModelVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskFeatureSnapshot" (
  "id" TEXT NOT NULL,
  "eventId" TEXT,
  "correlationId" TEXT,
  "actorId" TEXT,
  "actorRole" "Role",
  "institutionId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "features" JSONB NOT NULL,
  "featuresWindowStart" TIMESTAMP(3),
  "featuresWindowEnd" TIMESTAMP(3),
  "observedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiskFeatureSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskEventRecord" (
  "id" TEXT NOT NULL,
  "eventId" TEXT,
  "correlationId" TEXT,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "featuresSnapshotRef" TEXT NOT NULL,
  "riskScore" DOUBLE PRECISION NOT NULL,
  "riskBand" "RiskBand" NOT NULL,
  "topSignals" JSONB,
  "modelVersionId" TEXT,
  "modelVersion" TEXT NOT NULL,
  "inferenceTs" TIMESTAMP(3) NOT NULL,
  "reviewStatus" "RiskReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiskEventRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RiskModelVersion_modelVersion_key" ON "RiskModelVersion"("modelVersion");
CREATE INDEX "RiskModelVersion_modelType_createdAt_idx" ON "RiskModelVersion"("modelType", "createdAt");
CREATE INDEX "RiskModelVersion_isActive_idx" ON "RiskModelVersion"("isActive");

CREATE INDEX "RiskFeatureSnapshot_eventId_idx" ON "RiskFeatureSnapshot"("eventId");
CREATE INDEX "RiskFeatureSnapshot_correlationId_observedAt_idx" ON "RiskFeatureSnapshot"("correlationId", "observedAt");
CREATE INDEX "RiskFeatureSnapshot_actorId_observedAt_idx" ON "RiskFeatureSnapshot"("actorId", "observedAt");
CREATE INDEX "RiskFeatureSnapshot_action_observedAt_idx" ON "RiskFeatureSnapshot"("action", "observedAt");
CREATE INDEX "RiskFeatureSnapshot_createdAt_idx" ON "RiskFeatureSnapshot"("createdAt");

CREATE INDEX "RiskEventRecord_eventId_idx" ON "RiskEventRecord"("eventId");
CREATE INDEX "RiskEventRecord_correlationId_inferenceTs_idx" ON "RiskEventRecord"("correlationId", "inferenceTs");
CREATE INDEX "RiskEventRecord_actorId_inferenceTs_idx" ON "RiskEventRecord"("actorId", "inferenceTs");
CREATE INDEX "RiskEventRecord_riskBand_inferenceTs_idx" ON "RiskEventRecord"("riskBand", "inferenceTs");
CREATE INDEX "RiskEventRecord_reviewStatus_inferenceTs_idx" ON "RiskEventRecord"("reviewStatus", "inferenceTs");
CREATE INDEX "RiskEventRecord_createdAt_idx" ON "RiskEventRecord"("createdAt");

ALTER TABLE "RiskEventRecord"
  ADD CONSTRAINT "RiskEventRecord_featuresSnapshotRef_fkey"
  FOREIGN KEY ("featuresSnapshotRef") REFERENCES "RiskFeatureSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RiskEventRecord"
  ADD CONSTRAINT "RiskEventRecord_modelVersionId_fkey"
  FOREIGN KEY ("modelVersionId") REFERENCES "RiskModelVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
