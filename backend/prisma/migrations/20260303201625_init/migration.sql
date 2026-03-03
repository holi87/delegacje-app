-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DELEGATED');

-- CreateEnum
CREATE TYPE "DelegationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'SETTLED');

-- CreateEnum
CREATE TYPE "DelegationType" AS ENUM ('DOMESTIC', 'FOREIGN');

-- CreateEnum
CREATE TYPE "TransportType" AS ENUM ('COMPANY_VEHICLE', 'PUBLIC_TRANSPORT', 'PRIVATE_VEHICLE', 'MIXED');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('CAR_ABOVE_900', 'CAR_BELOW_900', 'MOTORCYCLE', 'MOPED');

-- CreateEnum
CREATE TYPE "AccommodationType" AS ENUM ('RECEIPT', 'LUMP_SUM', 'FREE', 'NONE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DELEGATED',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "default_vehicle" "VehicleType",
    "vehicle_plate" TEXT,
    "vehicle_capacity" TEXT,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "DelegationType" NOT NULL DEFAULT 'DOMESTIC',
    "status" "DelegationStatus" NOT NULL DEFAULT 'DRAFT',
    "purpose" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departure_at" TIMESTAMP(3) NOT NULL,
    "return_at" TIMESTAMP(3) NOT NULL,
    "transport_type" "TransportType" NOT NULL,
    "vehicle_type" "VehicleType",
    "transport_notes" TEXT,
    "accommodation_type" "AccommodationType" NOT NULL DEFAULT 'NONE',
    "accommodation_nights" INTEGER NOT NULL DEFAULT 0,
    "accommodation_total" DECIMAL(10,2),
    "advance_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_diet" DECIMAL(10,2),
    "total_accommodation" DECIMAL(10,2),
    "total_transport" DECIMAL(10,2),
    "total_additional" DECIMAL(10,2),
    "grand_total" DECIMAL(10,2),
    "amount_due" DECIMAL(10,2),
    "foreign_country" TEXT,
    "foreign_currency" TEXT,
    "settled_at" TIMESTAMP(3),
    "settled_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegation_days" (
    "id" TEXT NOT NULL,
    "delegation_id" TEXT NOT NULL,
    "day_number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "hours_in_day" DECIMAL(4,2) NOT NULL,
    "breakfast_provided" BOOLEAN NOT NULL DEFAULT false,
    "lunch_provided" BOOLEAN NOT NULL DEFAULT false,
    "dinner_provided" BOOLEAN NOT NULL DEFAULT false,
    "accommodation_type" "AccommodationType" NOT NULL DEFAULT 'NONE',
    "accommodation_cost" DECIMAL(10,2),
    "diet_base" DECIMAL(10,2),
    "diet_deductions" DECIMAL(10,2),
    "diet_final" DECIMAL(10,2),

    CONSTRAINT "delegation_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mileage_details" (
    "id" TEXT NOT NULL,
    "delegation_id" TEXT NOT NULL,
    "vehicle_type" "VehicleType" NOT NULL,
    "vehicle_plate" TEXT NOT NULL,
    "distance_km" DECIMAL(10,1) NOT NULL,
    "rate_per_km" DECIMAL(5,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "mileage_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_receipts" (
    "id" TEXT NOT NULL,
    "delegation_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "receipt_number" TEXT,

    CONSTRAINT "transport_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "additional_costs" (
    "id" TEXT NOT NULL,
    "delegation_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "receipt_number" TEXT,

    CONSTRAINT "additional_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domestic_rates" (
    "id" TEXT NOT NULL,
    "daily_diet" DECIMAL(10,2) NOT NULL,
    "accommodation_lump_sum" DECIMAL(10,2) NOT NULL,
    "accommodation_max_receipt" DECIMAL(10,2) NOT NULL,
    "local_transport_lump_sum" DECIMAL(10,2) NOT NULL,
    "breakfast_deduction_pct" INTEGER NOT NULL DEFAULT 25,
    "lunch_deduction_pct" INTEGER NOT NULL DEFAULT 50,
    "dinner_deduction_pct" INTEGER NOT NULL DEFAULT 25,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domestic_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mileage_rates" (
    "id" TEXT NOT NULL,
    "vehicle_type" "VehicleType" NOT NULL,
    "rate_per_km" DECIMAL(5,2) NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mileage_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foreign_diet_rates" (
    "id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "country_name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "daily_diet" DECIMAL(10,2) NOT NULL,
    "accommodation_limit" DECIMAL(10,2) NOT NULL,
    "breakfast_deduction_pct" INTEGER NOT NULL DEFAULT 15,
    "lunch_deduction_pct" INTEGER NOT NULL DEFAULT 30,
    "dinner_deduction_pct" INTEGER NOT NULL DEFAULT 30,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "foreign_diet_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_info" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nip" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_info_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "delegations_user_id_idx" ON "delegations"("user_id");

-- CreateIndex
CREATE INDEX "delegations_status_idx" ON "delegations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "delegation_days_delegation_id_day_number_key" ON "delegation_days"("delegation_id", "day_number");

-- CreateIndex
CREATE UNIQUE INDEX "mileage_details_delegation_id_key" ON "mileage_details"("delegation_id");

-- CreateIndex
CREATE UNIQUE INDEX "foreign_diet_rates_country_code_valid_from_key" ON "foreign_diet_rates"("country_code", "valid_from");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation_days" ADD CONSTRAINT "delegation_days_delegation_id_fkey" FOREIGN KEY ("delegation_id") REFERENCES "delegations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mileage_details" ADD CONSTRAINT "mileage_details_delegation_id_fkey" FOREIGN KEY ("delegation_id") REFERENCES "delegations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_receipts" ADD CONSTRAINT "transport_receipts_delegation_id_fkey" FOREIGN KEY ("delegation_id") REFERENCES "delegations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "additional_costs" ADD CONSTRAINT "additional_costs_delegation_id_fkey" FOREIGN KEY ("delegation_id") REFERENCES "delegations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
