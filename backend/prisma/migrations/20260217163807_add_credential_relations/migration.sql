/*
  Warnings:

  - You are about to drop the column `uploaderClerkId` on the `Credential` table. All the data in the column will be lost.
  - Added the required column `issuedById` to the `Credential` table without a default value. This is not possible if the table is not empty.
  - Added the required column `studentId` to the `Credential` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('PENDING', 'ISSUED', 'VERIFIED', 'REVOKED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Credential" DROP COLUMN "uploaderClerkId",
ADD COLUMN     "aiReport" JSONB,
ADD COLUMN     "aiScore" DOUBLE PRECISION,
ADD COLUMN     "aiStatus" TEXT,
ADD COLUMN     "anchoredAt" TIMESTAMP(3),
ADD COLUMN     "chain" TEXT,
ADD COLUMN     "fileHash" TEXT,
ADD COLUMN     "issuedById" TEXT NOT NULL,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "status" "CredentialStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "storageKey" TEXT,
ADD COLUMN     "studentId" TEXT NOT NULL,
ADD COLUMN     "txHash" TEXT;

-- CreateIndex
CREATE INDEX "Credential_studentId_idx" ON "Credential"("studentId");

-- CreateIndex
CREATE INDEX "Credential_issuedById_idx" ON "Credential"("issuedById");

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
