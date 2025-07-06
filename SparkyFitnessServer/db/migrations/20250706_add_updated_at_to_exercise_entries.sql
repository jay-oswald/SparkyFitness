ALTER TABLE "public"."exercise_entries" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();

-- Set updated_at for existing rows to their created_at value
UPDATE "public"."exercise_entries" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;

-- Alter the column to be NOT NULL after populating existing values
ALTER TABLE "public"."exercise_entries" ALTER COLUMN "updated_at" SET NOT NULL;