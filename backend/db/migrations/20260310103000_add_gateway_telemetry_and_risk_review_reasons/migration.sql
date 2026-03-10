-- CreateEnum
CREATE TYPE "RiskReviewReasonCode" AS ENUM (
  'OTP_BRUTE_FORCE',
  'TOKEN_ABUSE',
  'RATE_LIMIT_ABUSE',
  'CROSS_SCOPE_ACCESS',
  'PRIVILEGE_MISUSE',
  'AUTOMATED_PROBING',
  'SUSPICIOUS_BULK_ACTIVITY',
  'OTHER_ABUSE',
  'USER_MISTAKE',
  'TEST_ACTIVITY',
  'EXPECTED_ADMIN_ACTION',
  'EXPECTED_INSTITUTION_FLOW',
  'FALSE_POSITIVE_PATTERN',
  'OTHER_BENIGN',
  'NEEDS_MORE_CONTEXT',
  'INSUFFICIENT_EVIDENCE',
  'MIXED_SIGNALS'
);

-- AlterTable
ALTER TABLE "RiskEventRecord"
ADD COLUMN "reviewReasonCode" "RiskReviewReasonCode",
ADD COLUMN "reviewReasonDetail" TEXT;

-- CreateTable
CREATE TABLE "GatewayRequestTelemetry" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "correlationId" TEXT,
  "requestTs" TIMESTAMP(3) NOT NULL,
  "routeKey" TEXT NOT NULL,
  "routeClass" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "rateLimitOutcome" TEXT NOT NULL,
  "actorId" TEXT,
  "actorRole" "Role",
  "actorIdentityHash" TEXT,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "is401" BOOLEAN NOT NULL DEFAULT false,
  "is403" BOOLEAN NOT NULL DEFAULT false,
  "is429" BOOLEAN NOT NULL DEFAULT false,
  "is5xx" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GatewayRequestTelemetry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GatewayRequestTelemetry_eventId_key" ON "GatewayRequestTelemetry"("eventId");

-- CreateIndex
CREATE INDEX "RiskEventRecord_reviewReasonCode_inferenceTs_idx" ON "RiskEventRecord"("reviewReasonCode", "inferenceTs");

-- CreateIndex
CREATE INDEX "GatewayRequestTelemetry_requestTs_idx" ON "GatewayRequestTelemetry"("requestTs");

-- CreateIndex
CREATE INDEX "GatewayRequestTelemetry_correlationId_idx" ON "GatewayRequestTelemetry"("correlationId");

-- CreateIndex
CREATE INDEX "GatewayRequestTelemetry_actorId_idx" ON "GatewayRequestTelemetry"("actorId");

-- CreateIndex
CREATE INDEX "GatewayRequestTelemetry_routeClass_idx" ON "GatewayRequestTelemetry"("routeClass");

-- CreateIndex
CREATE INDEX "GatewayRequestTelemetry_routeKey_idx" ON "GatewayRequestTelemetry"("routeKey");

-- CreateIndex
CREATE INDEX "GatewayRequestTelemetry_statusCode_idx" ON "GatewayRequestTelemetry"("statusCode");

-- CreateIndex
CREATE INDEX "GatewayRequestTelemetry_rateLimitOutcome_idx" ON "GatewayRequestTelemetry"("rateLimitOutcome");

-- CreateIndex
CREATE INDEX "GatewayRequestTelemetry_createdAt_idx" ON "GatewayRequestTelemetry"("createdAt");
