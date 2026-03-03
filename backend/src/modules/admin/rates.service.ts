import { PrismaClient, VehicleType } from '@prisma/client';

// =====================
// Domestic Rates
// =====================

export async function listDomesticRates(prisma: PrismaClient) {
  const rates = await prisma.domesticRate.findMany({
    orderBy: { validFrom: 'desc' },
  });

  return rates.map((r) => ({
    id: r.id,
    dailyDiet: r.dailyDiet.toString(),
    accommodationLumpSum: r.accommodationLumpSum.toString(),
    accommodationMaxReceipt: r.accommodationMaxReceipt.toString(),
    localTransportLumpSum: r.localTransportLumpSum.toString(),
    breakfastDeductionPct: r.breakfastDeductionPct,
    lunchDeductionPct: r.lunchDeductionPct,
    dinnerDeductionPct: r.dinnerDeductionPct,
    validFrom: r.validFrom.toISOString(),
    validTo: r.validTo?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createDomesticRate(
  prisma: PrismaClient,
  data: {
    dailyDiet: string;
    accommodationLumpSum: string;
    accommodationMaxReceipt: string;
    localTransportLumpSum: string;
    breakfastDeductionPct: number;
    lunchDeductionPct: number;
    dinnerDeductionPct: number;
    validFrom: string;
    validTo?: string | null;
  }
) {
  const rate = await prisma.domesticRate.create({
    data: {
      dailyDiet: parseFloat(data.dailyDiet),
      accommodationLumpSum: parseFloat(data.accommodationLumpSum),
      accommodationMaxReceipt: parseFloat(data.accommodationMaxReceipt),
      localTransportLumpSum: parseFloat(data.localTransportLumpSum),
      breakfastDeductionPct: data.breakfastDeductionPct,
      lunchDeductionPct: data.lunchDeductionPct,
      dinnerDeductionPct: data.dinnerDeductionPct,
      validFrom: new Date(data.validFrom),
      validTo: data.validTo ? new Date(data.validTo) : null,
    },
  });

  return {
    id: rate.id,
    dailyDiet: rate.dailyDiet.toString(),
    accommodationLumpSum: rate.accommodationLumpSum.toString(),
    accommodationMaxReceipt: rate.accommodationMaxReceipt.toString(),
    localTransportLumpSum: rate.localTransportLumpSum.toString(),
    breakfastDeductionPct: rate.breakfastDeductionPct,
    lunchDeductionPct: rate.lunchDeductionPct,
    dinnerDeductionPct: rate.dinnerDeductionPct,
    validFrom: rate.validFrom.toISOString(),
    validTo: rate.validTo?.toISOString() ?? null,
    createdAt: rate.createdAt.toISOString(),
  };
}

export async function updateDomesticRate(
  prisma: PrismaClient,
  id: string,
  data: {
    dailyDiet?: string;
    accommodationLumpSum?: string;
    accommodationMaxReceipt?: string;
    localTransportLumpSum?: string;
    breakfastDeductionPct?: number;
    lunchDeductionPct?: number;
    dinnerDeductionPct?: number;
    validFrom?: string;
    validTo?: string | null;
  }
) {
  const updateData: Record<string, unknown> = {};

  if (data.dailyDiet !== undefined) updateData.dailyDiet = parseFloat(data.dailyDiet);
  if (data.accommodationLumpSum !== undefined) updateData.accommodationLumpSum = parseFloat(data.accommodationLumpSum);
  if (data.accommodationMaxReceipt !== undefined) updateData.accommodationMaxReceipt = parseFloat(data.accommodationMaxReceipt);
  if (data.localTransportLumpSum !== undefined) updateData.localTransportLumpSum = parseFloat(data.localTransportLumpSum);
  if (data.breakfastDeductionPct !== undefined) updateData.breakfastDeductionPct = data.breakfastDeductionPct;
  if (data.lunchDeductionPct !== undefined) updateData.lunchDeductionPct = data.lunchDeductionPct;
  if (data.dinnerDeductionPct !== undefined) updateData.dinnerDeductionPct = data.dinnerDeductionPct;
  if (data.validFrom !== undefined) updateData.validFrom = new Date(data.validFrom);
  if (data.validTo !== undefined) updateData.validTo = data.validTo ? new Date(data.validTo) : null;

  const rate = await prisma.domesticRate.update({
    where: { id },
    data: updateData,
  });

  return {
    id: rate.id,
    dailyDiet: rate.dailyDiet.toString(),
    accommodationLumpSum: rate.accommodationLumpSum.toString(),
    accommodationMaxReceipt: rate.accommodationMaxReceipt.toString(),
    localTransportLumpSum: rate.localTransportLumpSum.toString(),
    breakfastDeductionPct: rate.breakfastDeductionPct,
    lunchDeductionPct: rate.lunchDeductionPct,
    dinnerDeductionPct: rate.dinnerDeductionPct,
    validFrom: rate.validFrom.toISOString(),
    validTo: rate.validTo?.toISOString() ?? null,
    createdAt: rate.createdAt.toISOString(),
  };
}

// =====================
// Mileage Rates
// =====================

export async function listMileageRates(prisma: PrismaClient) {
  const rates = await prisma.mileageRate.findMany({
    orderBy: [{ validFrom: 'desc' }, { vehicleType: 'asc' }],
  });

  return rates.map((r) => ({
    id: r.id,
    vehicleType: r.vehicleType,
    ratePerKm: r.ratePerKm.toString(),
    validFrom: r.validFrom.toISOString(),
    validTo: r.validTo?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createMileageRate(
  prisma: PrismaClient,
  data: {
    vehicleType: VehicleType;
    ratePerKm: string;
    validFrom: string;
    validTo?: string | null;
  }
) {
  const rate = await prisma.mileageRate.create({
    data: {
      vehicleType: data.vehicleType,
      ratePerKm: parseFloat(data.ratePerKm),
      validFrom: new Date(data.validFrom),
      validTo: data.validTo ? new Date(data.validTo) : null,
    },
  });

  return {
    id: rate.id,
    vehicleType: rate.vehicleType,
    ratePerKm: rate.ratePerKm.toString(),
    validFrom: rate.validFrom.toISOString(),
    validTo: rate.validTo?.toISOString() ?? null,
    createdAt: rate.createdAt.toISOString(),
  };
}

export async function updateMileageRate(
  prisma: PrismaClient,
  id: string,
  data: {
    vehicleType?: VehicleType;
    ratePerKm?: string;
    validFrom?: string;
    validTo?: string | null;
  }
) {
  const updateData: Record<string, unknown> = {};

  if (data.vehicleType !== undefined) updateData.vehicleType = data.vehicleType;
  if (data.ratePerKm !== undefined) updateData.ratePerKm = parseFloat(data.ratePerKm);
  if (data.validFrom !== undefined) updateData.validFrom = new Date(data.validFrom);
  if (data.validTo !== undefined) updateData.validTo = data.validTo ? new Date(data.validTo) : null;

  const rate = await prisma.mileageRate.update({
    where: { id },
    data: updateData,
  });

  return {
    id: rate.id,
    vehicleType: rate.vehicleType,
    ratePerKm: rate.ratePerKm.toString(),
    validFrom: rate.validFrom.toISOString(),
    validTo: rate.validTo?.toISOString() ?? null,
    createdAt: rate.createdAt.toISOString(),
  };
}
