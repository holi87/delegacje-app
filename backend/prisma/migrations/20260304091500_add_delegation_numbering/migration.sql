-- CreateTable
CREATE TABLE "delegation_number_counter" (
    "key" TEXT NOT NULL,
    "next_value" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "delegation_number_counter_pkey" PRIMARY KEY ("key")
);

-- AlterTable
ALTER TABLE "delegations" ADD COLUMN "number" INTEGER;

-- Backfill existing delegations with a stable sequential number (oldest first)
WITH ordered AS (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at" ASC, "id" ASC) AS seq
    FROM "delegations"
)
UPDATE "delegations" d
SET "number" = o.seq
FROM ordered o
WHERE d."id" = o."id";

-- Ensure counter exists and points to next available number
INSERT INTO "delegation_number_counter" ("key", "next_value")
VALUES ('delegation', 1)
ON CONFLICT ("key") DO NOTHING;

UPDATE "delegation_number_counter"
SET "next_value" = COALESCE((SELECT MAX("number") + 1 FROM "delegations"), 1)
WHERE "key" = 'delegation';

-- Make number mandatory and unique
ALTER TABLE "delegations" ALTER COLUMN "number" SET NOT NULL;
CREATE UNIQUE INDEX "delegations_number_key" ON "delegations"("number");
