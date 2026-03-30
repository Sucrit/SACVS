CREATE TYPE "StepUpAction" AS ENUM (
  'ROLE_CHANGE',
  'STATUS_CHANGE',
  'CREDENTIAL_ISSUE',
  'BULK_STUDENT_CREATE',
  'QR_DOWNLOAD_ENABLE'
);

CREATE TABLE "StepUpChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" "StepUpAction" NOT NULL,
  "targetId" TEXT,
  "payloadHash" TEXT,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "lockedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StepUpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StepUpSession" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" "StepUpAction" NOT NULL,
  "targetId" TEXT,
  "payloadHash" TEXT,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StepUpSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StepUpSession_challengeId_key" ON "StepUpSession"("challengeId");
CREATE UNIQUE INDEX "StepUpSession_tokenHash_key" ON "StepUpSession"("tokenHash");

CREATE INDEX "StepUpChallenge_userId_createdAt_idx" ON "StepUpChallenge"("userId", "createdAt");
CREATE INDEX "StepUpChallenge_action_expiresAt_idx" ON "StepUpChallenge"("action", "expiresAt");
CREATE INDEX "StepUpChallenge_expiresAt_idx" ON "StepUpChallenge"("expiresAt");

CREATE INDEX "StepUpSession_userId_action_expiresAt_idx" ON "StepUpSession"("userId", "action", "expiresAt");
CREATE INDEX "StepUpSession_expiresAt_idx" ON "StepUpSession"("expiresAt");
CREATE INDEX "StepUpSession_usedAt_idx" ON "StepUpSession"("usedAt");

ALTER TABLE "StepUpChallenge"
  ADD CONSTRAINT "StepUpChallenge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StepUpSession"
  ADD CONSTRAINT "StepUpSession_challengeId_fkey"
  FOREIGN KEY ("challengeId") REFERENCES "StepUpChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StepUpSession"
  ADD CONSTRAINT "StepUpSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
