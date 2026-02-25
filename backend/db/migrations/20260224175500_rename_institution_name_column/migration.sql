DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Institution'
      AND column_name = 'name'
  ) THEN
    ALTER TABLE "Institution" RENAME COLUMN "name" TO "institutionName";
  END IF;
END $$;
