-- AlterTable
ALTER TABLE "delegation_days" ADD COLUMN     "diet_rate" DECIMAL(10,2),
ADD COLUMN     "is_foreign" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "delegations" ADD COLUMN     "border_crossing_in" TIMESTAMP(3),
ADD COLUMN     "border_crossing_out" TIMESTAMP(3),
ADD COLUMN     "foreign_rate_id" TEXT,
ADD COLUMN     "total_domestic_diet" DECIMAL(10,2),
ADD COLUMN     "total_foreign_diet" DECIMAL(10,2);
