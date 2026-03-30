ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REQUEST_RECEIPT_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REQUEST_RECEIPT_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REQUEST_RECEIPT_INVALID';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REQUEST_RECEIPT_EXPIRED';

CREATE TABLE "CredentialRequestApprovalReceipt" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "receiptCode" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "invalidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CredentialRequestApprovalReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CredentialRequestApprovalReceipt_receiptCode_key" ON "CredentialRequestApprovalReceipt"("receiptCode");
CREATE UNIQUE INDEX "CredentialRequestApprovalReceipt_tokenHash_key" ON "CredentialRequestApprovalReceipt"("tokenHash");

CREATE INDEX "CredentialRequestApprovalReceipt_requestId_studentId_expiresAt_idx" ON "CredentialRequestApprovalReceipt"("requestId", "studentId", "expiresAt");
CREATE INDEX "CredentialRequestApprovalReceipt_studentId_createdAt_idx" ON "CredentialRequestApprovalReceipt"("studentId", "createdAt");
CREATE INDEX "CredentialRequestApprovalReceipt_usedAt_idx" ON "CredentialRequestApprovalReceipt"("usedAt");
CREATE INDEX "CredentialRequestApprovalReceipt_invalidatedAt_idx" ON "CredentialRequestApprovalReceipt"("invalidatedAt");

ALTER TABLE "CredentialRequestApprovalReceipt"
  ADD CONSTRAINT "CredentialRequestApprovalReceipt_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "CredentialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CredentialRequestApprovalReceipt"
  ADD CONSTRAINT "CredentialRequestApprovalReceipt_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CredentialRequestApprovalReceipt"
  ADD CONSTRAINT "CredentialRequestApprovalReceipt_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
