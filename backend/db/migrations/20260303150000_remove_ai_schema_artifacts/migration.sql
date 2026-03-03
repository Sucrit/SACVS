-- Normalize credential status values before enum cleanup
UPDATE "Credential"
SET "status" = 'PENDING'
WHERE "status"::text = 'AI_REVIEW';

-- Normalize legacy AI audit actions before enum cleanup
UPDATE "AuditLog"
SET "action" = 'SETTINGS_CHANGED'
WHERE "action"::text = 'AI_VALIDATION_RUN';

UPDATE "AuditLog"
SET "action" = 'SECURITY_ALERT'
WHERE "action"::text = 'AI_VALIDATION_FAILED';

UPDATE "AuditLog"
SET "action" = 'CREDENTIAL_VERIFIED'
WHERE "action"::text = 'CREDENTIAL_VERIFIED_BY_AI';

-- Drop AI/fraud dependent tables first
DROP TABLE IF EXISTS "FraudReviewLabel";
DROP TABLE IF EXISTS "FraudAnalysisJob";

-- Drop AI columns from Credential
ALTER TABLE "Credential"
  DROP COLUMN IF EXISTS "aiStatus",
  DROP COLUMN IF EXISTS "aiScore",
  DROP COLUMN IF EXISTS "aiReport",
  DROP COLUMN IF EXISTS "aiValidatedAt",
  DROP COLUMN IF EXISTS "aiDecision",
  DROP COLUMN IF EXISTS "aiReviewStatus",
  DROP COLUMN IF EXISTS "aiModel",
  DROP COLUMN IF EXISTS "aiModelVersion",
  DROP COLUMN IF EXISTS "aiSignals",
  DROP COLUMN IF EXISTS "aiReviewedById",
  DROP COLUMN IF EXISTS "aiReviewedAt",
  DROP COLUMN IF EXISTS "aiOverrideReason";

-- Remove AI index from Credential
DROP INDEX IF EXISTS "Credential_aiDecision_status_idx";

-- Rebuild CredentialStatus enum without AI_REVIEW
ALTER TYPE "CredentialStatus" RENAME TO "CredentialStatus_old";
CREATE TYPE "CredentialStatus" AS ENUM ('PENDING', 'ISSUED', 'REVOKED', 'EXPIRED');
ALTER TABLE "Credential"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "CredentialStatus" USING ("status"::text::"CredentialStatus"),
  ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "CredentialStatus_old";

-- Rebuild AuditAction enum without AI-only values.
-- Handles both normal state (AuditAction exists) and partial state (AuditAction_old exists).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuditAction_old') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuditAction') THEN
      EXECUTE 'CREATE TYPE "AuditAction" AS ENUM (
        ''USER_CREATED'',
        ''USER_APPROVED'',
        ''USER_REJECTED'',
        ''USER_SUSPENDED'',
        ''USER_DELETED'',
        ''CREDENTIAL_CREATED'',
        ''CREDENTIAL_ISSUED'',
        ''CREDENTIAL_VERIFIED'',
        ''CREDENTIAL_REVOKED'',
        ''CREDENTIAL_REQUESTED'',
        ''CREDENTIAL_REQUEST_APPROVED'',
        ''CREDENTIAL_REQUEST_REJECTED'',
        ''CREDENTIAL_REQUEST_PENDING'',
        ''CREDENTIAL_REQUEST_COMPLETED'',
        ''BLOCKCHAIN_ANCHORED'',
        ''BLOCKCHAIN_ANCHORING_FAILED'',
        ''ROLE_CHANGED'',
        ''ROLE_ASSIGNED'',
        ''ROLE_REMOVED'',
        ''USER_PERMISSIONS_UPDATED'',
        ''CREDENTIAL_REQUEST_VERIFIED'',
        ''CREDENTIAL_VERIFIED_BY_BLOCKCHAIN'',
        ''ACCESS_GRANTED'',
        ''ACCESS_DENIED'',
        ''SUSPICIOUS_ACTIVITY_DETECTED'',
        ''SECURITY_INCIDENT'',
        ''SETTINGS_CHANGED'',
        ''SECURITY_ALERT'',
        ''QR_TOKEN_GENERATED'',
        ''QR_TOKEN_CONSUMED'',
        ''QR_TOKEN_INVALID'',
        ''QR_TOKEN_EXPIRED''
      )';
    END IF;

    EXECUTE 'ALTER TABLE "AuditLog"
      ALTER COLUMN "action" TYPE "AuditAction" USING ("action"::text::"AuditAction")';
    EXECUTE 'DROP TYPE IF EXISTS "AuditAction_old"';

  ELSIF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuditAction') THEN
    EXECUTE 'ALTER TYPE "AuditAction" RENAME TO "AuditAction_old"';
    EXECUTE 'CREATE TYPE "AuditAction" AS ENUM (
      ''USER_CREATED'',
      ''USER_APPROVED'',
      ''USER_REJECTED'',
      ''USER_SUSPENDED'',
      ''USER_DELETED'',
      ''CREDENTIAL_CREATED'',
      ''CREDENTIAL_ISSUED'',
      ''CREDENTIAL_VERIFIED'',
      ''CREDENTIAL_REVOKED'',
      ''CREDENTIAL_REQUESTED'',
      ''CREDENTIAL_REQUEST_APPROVED'',
      ''CREDENTIAL_REQUEST_REJECTED'',
      ''CREDENTIAL_REQUEST_PENDING'',
      ''CREDENTIAL_REQUEST_COMPLETED'',
      ''BLOCKCHAIN_ANCHORED'',
      ''BLOCKCHAIN_ANCHORING_FAILED'',
      ''ROLE_CHANGED'',
      ''ROLE_ASSIGNED'',
      ''ROLE_REMOVED'',
      ''USER_PERMISSIONS_UPDATED'',
      ''CREDENTIAL_REQUEST_VERIFIED'',
      ''CREDENTIAL_VERIFIED_BY_BLOCKCHAIN'',
      ''ACCESS_GRANTED'',
      ''ACCESS_DENIED'',
      ''SUSPICIOUS_ACTIVITY_DETECTED'',
      ''SECURITY_INCIDENT'',
      ''SETTINGS_CHANGED'',
      ''SECURITY_ALERT'',
      ''QR_TOKEN_GENERATED'',
      ''QR_TOKEN_CONSUMED'',
      ''QR_TOKEN_INVALID'',
      ''QR_TOKEN_EXPIRED''
    )';
    EXECUTE 'ALTER TABLE "AuditLog"
      ALTER COLUMN "action" TYPE "AuditAction" USING ("action"::text::"AuditAction")';
    EXECUTE 'DROP TYPE IF EXISTS "AuditAction_old"';
  END IF;
END $$;

-- Drop now-unused AI/fraud enums
DROP TYPE IF EXISTS "AiDecision";
DROP TYPE IF EXISTS "AiReviewStatus";
DROP TYPE IF EXISTS "FraudAnalysisJobStatus";
DROP TYPE IF EXISTS "FraudLabel";
DROP TYPE IF EXISTS "FraudLabelSource";
