-- CreateEnum
CREATE TYPE "AdminReadableReportStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- DropIndex
DROP INDEX "GatewayRequestTelemetry_actorId_idx";

-- DropIndex
DROP INDEX "GatewayRequestTelemetry_correlationId_idx";

-- DropIndex
DROP INDEX "GatewayRequestTelemetry_rateLimitOutcome_idx";

-- DropIndex
DROP INDEX "GatewayRequestTelemetry_routeClass_idx";

-- DropIndex
DROP INDEX "GatewayRequestTelemetry_routeKey_idx";

-- DropIndex
DROP INDEX "GatewayRequestTelemetry_statusCode_idx";

-- AlterTable
ALTER TABLE "RiskEventRecord" ADD COLUMN     "adminReadableReport" JSONB,
ADD COLUMN     "adminReadableReportError" TEXT,
ADD COLUMN     "adminReadableReportGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "adminReadableReportModel" TEXT,
ADD COLUMN     "adminReadableReportStatus" "AdminReadableReportStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "StudentProfile" ALTER COLUMN "phone" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "GatewayRequestTelemetry_correlationId_requestTs_idx" ON "GatewayRequestTelemetry"("correlationId", "requestTs");

-- CreateIndex
CREATE INDEX "GatewayRequestTelemetry_actorId_requestTs_idx" ON "GatewayRequestTelemetry"("actorId", "requestTs");

-- CreateIndex
CREATE INDEX "GatewayRequestTelemetry_routeClass_requestTs_idx" ON "GatewayRequestTelemetry"("routeClass", "requestTs");

-- CreateIndex
CREATE INDEX "GatewayRequestTelemetry_routeKey_requestTs_idx" ON "GatewayRequestTelemetry"("routeKey", "requestTs");

-- CreateIndex
CREATE INDEX "GatewayRequestTelemetry_statusCode_requestTs_idx" ON "GatewayRequestTelemetry"("statusCode", "requestTs");

-- CreateIndex
CREATE INDEX "GatewayRequestTelemetry_rateLimitOutcome_requestTs_idx" ON "GatewayRequestTelemetry"("rateLimitOutcome", "requestTs");

-- RenameIndex
ALTER INDEX "CredentialRequestApprovalReceipt_requestId_studentId_expiresAt_" RENAME TO "CredentialRequestApprovalReceipt_requestId_studentId_expire_idx";
