-- CreateTable
CREATE TABLE "mileage_segments" (
    "id" TEXT NOT NULL,
    "mileage_details_id" TEXT NOT NULL,
    "segment_number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "start_location" TEXT NOT NULL,
    "end_location" TEXT NOT NULL,
    "km" DECIMAL(10,1) NOT NULL,

    CONSTRAINT "mileage_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mileage_segments_mileage_details_id_segment_number_key" ON "mileage_segments"("mileage_details_id", "segment_number");

-- AddForeignKey
ALTER TABLE "mileage_segments" ADD CONSTRAINT "mileage_segments_mileage_details_id_fkey" FOREIGN KEY ("mileage_details_id") REFERENCES "mileage_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: create one segment for each existing MileageDetails row
INSERT INTO "mileage_segments" ("id", "mileage_details_id", "segment_number", "date", "start_location", "end_location", "km")
SELECT
    gen_random_uuid(),
    md."id",
    1,
    d."departure_at"::date,
    d."destination",
    d."destination",
    md."distance_km"
FROM "mileage_details" md
JOIN "delegations" d ON d."id" = md."delegation_id"
WHERE md."distance_km" > 0;
