ALTER TABLE "StudentProfile"
ADD COLUMN IF NOT EXISTS "street" TEXT,
ADD COLUMN IF NOT EXISTS "barangay" TEXT,
ADD COLUMN IF NOT EXISTS "city" TEXT,
ADD COLUMN IF NOT EXISTS "province" TEXT,
ADD COLUMN IF NOT EXISTS "zipCode" INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'StudentProfile'
      AND column_name = 'address'
  ) THEN
    EXECUTE '
      UPDATE "StudentProfile"
      SET
        "street" = COALESCE(NULLIF("street", ''''), COALESCE(NULLIF("address", ''''), ''N/A'')),
        "barangay" = COALESCE(NULLIF("barangay", ''''), ''N/A''),
        "city" = COALESCE(NULLIF("city", ''''), ''N/A''),
        "province" = COALESCE(NULLIF("province", ''''), ''N/A''),
        "zipCode" = COALESCE("zipCode", 1000)
    ';
  ELSE
    EXECUTE '
      UPDATE "StudentProfile"
      SET
        "street" = COALESCE(NULLIF("street", ''''), ''N/A''),
        "barangay" = COALESCE(NULLIF("barangay", ''''), ''N/A''),
        "city" = COALESCE(NULLIF("city", ''''), ''N/A''),
        "province" = COALESCE(NULLIF("province", ''''), ''N/A''),
        "zipCode" = COALESCE("zipCode", 1000)
    ';
  END IF;
END $$;

ALTER TABLE "StudentProfile"
ALTER COLUMN "street" SET NOT NULL,
ALTER COLUMN "barangay" SET NOT NULL,
ALTER COLUMN "city" SET NOT NULL,
ALTER COLUMN "province" SET NOT NULL,
ALTER COLUMN "zipCode" SET NOT NULL;

ALTER TABLE "StudentProfile"
DROP COLUMN IF EXISTS "address";
