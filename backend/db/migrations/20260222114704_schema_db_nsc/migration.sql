/*
  Warnings:

  - The values [REGISTRAR] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `notes` on the `CredentialRequest` table. All the data in the column will be lost.
  - Added the required column `requesterId` to the `CredentialRequest` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RequesterType" AS ENUM ('STUDENT', 'EMPLOYER', 'INSTITUTION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CREDENTIAL_REQUEST_PENDING';
ALTER TYPE "AuditAction" ADD VALUE 'CREDENTIAL_REQUEST_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'BLOCKCHAIN_ANCHORING_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'ROLE_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE 'ROLE_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_PERMISSIONS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'CREDENTIAL_REQUEST_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'CREDENTIAL_VERIFIED_BY_BLOCKCHAIN';
ALTER TYPE "AuditAction" ADD VALUE 'ACCESS_GRANTED';
ALTER TYPE "AuditAction" ADD VALUE 'SUSPICIOUS_ACTIVITY_DETECTED';
ALTER TYPE "AuditAction" ADD VALUE 'SECURITY_INCIDENT';

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('STUDENT', 'ADMIN', 'EMPLOYER', 'INSTITUTION');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TABLE "AuditLog" ALTER COLUMN "actorRole" TYPE "Role_new" USING ("actorRole"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STUDENT';
COMMIT;

-- AlterTable
ALTER TABLE "CredentialRequest" DROP COLUMN "notes",
ADD COLUMN     "employerId" TEXT,
ADD COLUMN     "institutionId" TEXT,
ADD COLUMN     "requesterId" TEXT NOT NULL,
ADD COLUMN     "requesterType" "RequesterType" NOT NULL DEFAULT 'STUDENT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "employerId" TEXT,
ADD COLUMN     "institutionId" TEXT;

-- CreateTable
CREATE TABLE "Employer" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accreditationNumber" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employer_email_key" ON "Employer"("email");

-- CreateIndex
CREATE INDEX "Employer_email_idx" ON "Employer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_email_key" ON "Institution"("email");

-- CreateIndex
CREATE INDEX "Institution_email_idx" ON "Institution"("email");

-- CreateIndex
CREATE INDEX "CredentialRequest_employerId_idx" ON "CredentialRequest"("employerId");

-- CreateIndex
CREATE INDEX "CredentialRequest_institutionId_idx" ON "CredentialRequest"("institutionId");

-- CreateIndex
CREATE INDEX "User_employerId_idx" ON "User"("employerId");

-- CreateIndex
CREATE INDEX "User_institutionId_idx" ON "User"("institutionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialRequest" ADD CONSTRAINT "CredentialRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialRequest" ADD CONSTRAINT "CredentialRequest_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialRequest" ADD CONSTRAINT "CredentialRequest_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
