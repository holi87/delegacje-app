-- AlterTable
ALTER TABLE "delegations" ADD COLUMN "number_label" TEXT;

-- Backfill existing delegations
UPDATE "delegations"
SET "number_label" = LPAD("number"::text, 4, '0') || '/DEL/' || EXTRACT(YEAR FROM "created_at")::text;

-- Make mandatory + unique
ALTER TABLE "delegations" ALTER COLUMN "number_label" SET NOT NULL;
CREATE UNIQUE INDEX "delegations_number_label_key" ON "delegations"("number_label");
