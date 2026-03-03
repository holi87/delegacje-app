-- AlterTable
ALTER TABLE "delegations" ADD COLUMN     "exchange_rate" DECIMAL(10,4),
ADD COLUMN     "exchange_rate_date" DATE,
ADD COLUMN     "exchange_rate_table" TEXT;
