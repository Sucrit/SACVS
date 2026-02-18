-- Add new identity columns for legacy auth
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

-- Backfill names from existing fullName values
UPDATE "User"
SET
  "firstName" = COALESCE(NULLIF(split_part(COALESCE("fullName", ''), ' ', 1), ''), 'Unknown'),
  "lastName" = COALESCE(NULLIF(regexp_replace(COALESCE("fullName", ''), '^\S+\s*', ''), ''), 'User')
WHERE "firstName" IS NULL OR "lastName" IS NULL;

-- Ensure email is populated before making it required
UPDATE "User"
SET "email" = CONCAT('legacy_', "id", '@local.invalid')
WHERE "email" IS NULL OR btrim("email") = '';

-- Drop obsolete clerk/open-auth columns
DROP INDEX IF EXISTS "User_clerkId_key";
ALTER TABLE "User" DROP COLUMN "clerkId";
ALTER TABLE "User" DROP COLUMN "fullName";

-- Enforce new contract
ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "lastName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
