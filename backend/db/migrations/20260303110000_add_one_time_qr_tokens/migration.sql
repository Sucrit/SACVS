-- Add audit actions for one-time QR lifecycle
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'QR_TOKEN_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'QR_TOKEN_CONSUMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'QR_TOKEN_INVALID';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'QR_TOKEN_EXPIRED';

-- One-time, short-lived QR verification tokens
CREATE TABLE "CredentialQrToken" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByType" TEXT,
    "usedById" TEXT,
    "usedByIp" TEXT,
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialQrToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CredentialQrToken_tokenHash_key" ON "CredentialQrToken"("tokenHash");
CREATE INDEX "CredentialQrToken_credentialId_studentId_expiresAt_idx" ON "CredentialQrToken"("credentialId", "studentId", "expiresAt");
CREATE INDEX "CredentialQrToken_studentId_createdAt_idx" ON "CredentialQrToken"("studentId", "createdAt");
CREATE INDEX "CredentialQrToken_usedAt_idx" ON "CredentialQrToken"("usedAt");
CREATE INDEX "CredentialQrToken_invalidatedAt_idx" ON "CredentialQrToken"("invalidatedAt");

ALTER TABLE "CredentialQrToken"
ADD CONSTRAINT "CredentialQrToken_credentialId_fkey"
FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CredentialQrToken"
ADD CONSTRAINT "CredentialQrToken_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
