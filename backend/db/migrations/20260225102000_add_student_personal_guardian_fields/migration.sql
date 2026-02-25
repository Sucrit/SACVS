DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'Sex'
  ) THEN
    CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');
  END IF;
END $$;

ALTER TABLE "StudentProfile"
  ADD COLUMN IF NOT EXISTS "birthday" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sex" "Sex",
  ADD COLUMN IF NOT EXISTS "guardianFullName" TEXT,
  ADD COLUMN IF NOT EXISTS "guardianRelationship" TEXT;
