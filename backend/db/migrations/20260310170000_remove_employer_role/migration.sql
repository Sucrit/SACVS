BEGIN;

DELETE FROM "RiskEventRecord"
WHERE "featuresSnapshotRef" IN (
  SELECT id FROM "RiskFeatureSnapshot"
  WHERE "actorRole" = 'EMPLOYER'
     OR "actorId" IN (SELECT id FROM "User" WHERE role = 'EMPLOYER')
);

DELETE FROM "RiskFeatureSnapshot"
WHERE "actorRole" = 'EMPLOYER'
   OR "actorId" IN (SELECT id FROM "User" WHERE role = 'EMPLOYER');

DELETE FROM "GatewayRequestTelemetry"
WHERE "actorRole" = 'EMPLOYER'
   OR "actorId" IN (SELECT id FROM "User" WHERE role = 'EMPLOYER');

DELETE FROM "AuditLog"
WHERE "actorRole" = 'EMPLOYER'
   OR "actorId" IN (SELECT id FROM "User" WHERE role = 'EMPLOYER');

DELETE FROM "CredentialRequest"
WHERE "requesterType" = 'EMPLOYER'
   OR "employerId" IS NOT NULL
   OR "requesterId" IN (SELECT id FROM "User" WHERE role = 'EMPLOYER');

DELETE FROM "User"
WHERE role = 'EMPLOYER';

DELETE FROM "Employer";

ALTER TABLE "CredentialRequest" DROP CONSTRAINT IF EXISTS "CredentialRequest_employerId_fkey";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_employerId_fkey";

DROP INDEX IF EXISTS "CredentialRequest_employerId_idx";
DROP INDEX IF EXISTS "User_employerId_idx";

ALTER TABLE "CredentialRequest" DROP COLUMN IF EXISTS "employerId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "employerId";

DROP TABLE IF EXISTS "Employer";

CREATE TYPE "RequesterType_new" AS ENUM ('STUDENT', 'INSTITUTION');
ALTER TABLE "CredentialRequest" ALTER COLUMN "requesterType" DROP DEFAULT;
ALTER TABLE "CredentialRequest" ALTER COLUMN "requesterType" TYPE "RequesterType_new" USING ("requesterType"::text::"RequesterType_new");
ALTER TYPE "RequesterType" RENAME TO "RequesterType_old";
ALTER TYPE "RequesterType_new" RENAME TO "RequesterType";
DROP TYPE "RequesterType_old";
ALTER TABLE "CredentialRequest" ALTER COLUMN "requesterType" SET DEFAULT 'STUDENT';

CREATE TYPE "Role_new" AS ENUM ('STUDENT', 'ADMIN', 'INSTITUTION');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TABLE "AuditLog" ALTER COLUMN "actorRole" TYPE "Role_new" USING ("actorRole"::text::"Role_new");
ALTER TABLE "RiskFeatureSnapshot" ALTER COLUMN "actorRole" TYPE "Role_new" USING ("actorRole"::text::"Role_new");
ALTER TABLE "GatewayRequestTelemetry" ALTER COLUMN "actorRole" TYPE "Role_new" USING ("actorRole"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STUDENT';

COMMIT;
