ALTER TABLE "CredentialQrToken"
ADD COLUMN "allowDocumentPreview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "allowDocumentDownload" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "CredentialQrDocumentToken" (
    "id" TEXT NOT NULL,
    "qrTokenId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialQrDocumentToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CredentialQrDocumentToken_qrTokenId_key" ON "CredentialQrDocumentToken"("qrTokenId");
CREATE UNIQUE INDEX "CredentialQrDocumentToken_tokenHash_key" ON "CredentialQrDocumentToken"("tokenHash");
CREATE INDEX "CredentialQrDocumentToken_credentialId_expiresAt_idx" ON "CredentialQrDocumentToken"("credentialId", "expiresAt");
CREATE INDEX "CredentialQrDocumentToken_usedAt_idx" ON "CredentialQrDocumentToken"("usedAt");

ALTER TABLE "CredentialQrDocumentToken"
ADD CONSTRAINT "CredentialQrDocumentToken_qrTokenId_fkey"
FOREIGN KEY ("qrTokenId") REFERENCES "CredentialQrToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CredentialQrDocumentToken"
ADD CONSTRAINT "CredentialQrDocumentToken_credentialId_fkey"
FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
