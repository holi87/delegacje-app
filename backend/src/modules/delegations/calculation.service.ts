import { PrismaClient, Decimal } from '@prisma/client';
import { calculateDuration } from '../../utils/date-helpers.js';

// =====================
// Types
// =====================

interface DayInput {
  dayNumber: number;
  date: string;
  breakfastProvided: boolean;
  lunchProvided: boolean;
  dinnerProvided: boolean;
  accommodationType: 'RECEIPT' | 'LUMP_SUM' | 'FREE' | 'NONE';
  accommodationCost: number | null;
}

interface MileageInput {
  vehicleType: 'CAR_ABOVE_900' | 'CAR_BELOW_900' | 'MOTORCYCLE' | 'MOPED';
  vehiclePlate: string;
  distanceKm: number;
}

interface TransportReceiptInput {
  description: string;
  amount: number;
  receiptNumber?: string | null;
}

interface AdditionalCostInput {
  description: string;
  category: string;
  amount: number;
  receiptNumber?: string | null;
}

export interface CalculationInput {
  departureAt: string;
  returnAt: string;
  transportType: 'COMPANY_VEHICLE' | 'PUBLIC_TRANSPORT' | 'PRIVATE_VEHICLE' | 'MIXED';
  vehicleType?: 'CAR_ABOVE_900' | 'CAR_BELOW_900' | 'MOTORCYCLE' | 'MOPED' | null;
  advanceAmount: number;
  days: DayInput[];
  mileageDetails?: MileageInput | null;
  transportReceipts: TransportReceiptInput[];
  additionalCosts: AdditionalCostInput[];
}

// Calculation result types matching API.md response format

interface DayDietDeductions {
  breakfast: number;
  lunch: number;
  dinner: number;
  total: number;
}

interface DayDietResult {
  dayNumber: number;
  hours: number;
  baseAmount: number;
  deductions: DayDietDeductions;
  finalAmount: number;
}

interface DietResult {
  rateUsed: number;
  days: DayDietResult[];
  total: number;
}

interface AccommodationNight {
  type: string;
  amount: number;
  overLimit?: boolean;
}

interface AccommodationResult {
  nights: AccommodationNight[];
  total: number;
}

interface MileageResult {
  distanceKm: number;
  ratePerKm: number;
  total: number;
}

interface TransportResult {
  type: string;
  mileage: MileageResult | null;
  receipts: TransportReceiptInput[];
  localTransportLumpSum: number;
  total: number;
}

interface AdditionalCostItem {
  description: string;
  amount: number;
}

interface AdditionalCostsResult {
  items: AdditionalCostItem[];
  total: number;
}

interface SummaryResult {
  dietTotal: number;
  accommodationTotal: number;
  transportTotal: number;
  additionalTotal: number;
  grandTotal: number;
  advanceAmount: number;
  amountDue: number;
}

export interface CalculationResult {
  duration: {
    totalHours: number;
    fullDays: number;
    remainingHours: number;
  };
  diet: DietResult;
  accommodation: AccommodationResult;
  transport: TransportResult;
  additionalCosts: AdditionalCostsResult;
  summary: SummaryResult;
}

// =====================
// Rate lookup helpers
// =====================

interface DomesticRateData {
  dailyDiet: number;
  accommodationLumpSum: number;
  accommodationMaxReceipt: number;
  localTransportLumpSum: number;
  breakfastDeductionPct: number;
  lunchDeductionPct: number;
  dinnerDeductionPct: number;
}

interface MileageRateData {
  ratePerKm: number;
}

/**
 * Find the applicable domestic rate for a given departure date.
 * Rates are looked up from DB, NOT hardcoded.
 */
async function findDomesticRate(
  prisma: PrismaClient,
  departureAt: Date
): Promise<DomesticRateData> {
  const rate = await prisma.domesticRate.findFirst({
    where: {
      validFrom: { lte: departureAt },
      OR: [{ validTo: null }, { validTo: { gte: departureAt } }],
    },
    orderBy: { validFrom: 'desc' },
  });

  if (!rate) {
    throw new Error('Nie znaleziono obowiązujących stawek diety krajowej dla daty wyjazdu');
  }

  return {
    dailyDiet: decimalToNumber(rate.dailyDiet),
    accommodationLumpSum: decimalToNumber(rate.accommodationLumpSum),
    accommodationMaxReceipt: decimalToNumber(rate.accommodationMaxReceipt),
    localTransportLumpSum: decimalToNumber(rate.localTransportLumpSum),
    breakfastDeductionPct: rate.breakfastDeductionPct,
    lunchDeductionPct: rate.lunchDeductionPct,
    dinnerDeductionPct: rate.dinnerDeductionPct,
  };
}

/**
 * Find the applicable mileage rate for a given vehicle type and departure date.
 */
async function findMileageRate(
  prisma: PrismaClient,
  vehicleType: string,
  departureAt: Date
): Promise<MileageRateData> {
  const rate = await prisma.mileageRate.findFirst({
    where: {
      vehicleType: vehicleType as any,
      validFrom: { lte: departureAt },
      OR: [{ validTo: null }, { validTo: { gte: departureAt } }],
    },
    orderBy: { validFrom: 'desc' },
  });

  if (!rate) {
    throw new Error(
      `Nie znaleziono obowiązujących stawek kilometrówki dla typu pojazdu ${vehicleType}`
    );
  }

  return {
    ratePerKm: decimalToNumber(rate.ratePerKm),
  };
}

// =====================
// Utility helpers
// =====================

/** Convert Prisma Decimal to JS number. */
function decimalToNumber(value: Decimal | number | string): number {
  if (typeof value === 'number') return value;
  return Number(value.toString());
}

/** Round to 2 decimal places (PLN grosze). */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// =====================
// Diet calculation
// =====================

/**
 * Calculate meal deductions for a single day.
 * CRITICAL RULE: Deductions are ALWAYS calculated from the FULL daily diet (e.g. 45 PLN),
 * even if only 50% of the diet applies for that day.
 */
function calculateMealDeductions(
  day: DayInput,
  rate: DomesticRateData
): DayDietDeductions {
  const fullDiet = rate.dailyDiet; // Always use the full diet as the deduction base

  const breakfast = day.breakfastProvided
    ? round2(fullDiet * (rate.breakfastDeductionPct / 100))
    : 0;
  const lunch = day.lunchProvided
    ? round2(fullDiet * (rate.lunchDeductionPct / 100))
    : 0;
  const dinner = day.dinnerProvided
    ? round2(fullDiet * (rate.dinnerDeductionPct / 100))
    : 0;

  return {
    breakfast,
    lunch,
    dinner,
    total: round2(breakfast + lunch + dinner),
  };
}

/**
 * Calculate diet for a single-day trip (total duration <= 24 hours).
 *
 * Rules:
 *   < 8h  => 0 PLN (no diet)
 *   8-12h => 50% of daily diet
 *   > 12h => 100% of daily diet
 */
function calculateSingleDayDiet(
  totalHours: number,
  day: DayInput,
  rate: DomesticRateData
): DayDietResult {
  let baseAmount: number;

  if (totalHours < 8) {
    baseAmount = 0;
  } else if (totalHours <= 12) {
    baseAmount = round2(rate.dailyDiet * 0.5);
  } else {
    baseAmount = rate.dailyDiet;
  }

  // If base is 0 (trip < 8h), no deductions apply
  if (baseAmount === 0) {
    return {
      dayNumber: day.dayNumber,
      hours: round2(totalHours),
      baseAmount: 0,
      deductions: { breakfast: 0, lunch: 0, dinner: 0, total: 0 },
      finalAmount: 0,
    };
  }

  const deductions = calculateMealDeductions(day, rate);
  // Diet per day cannot be negative (min 0)
  const finalAmount = round2(Math.max(0, baseAmount - deductions.total));

  return {
    dayNumber: day.dayNumber,
    hours: round2(totalHours),
    baseAmount,
    deductions,
    finalAmount,
  };
}

/**
 * Calculate diet for a multi-day trip (total duration > 24 hours).
 *
 * Rules:
 *   Each full 24h period => 100% of daily diet
 *   Remaining hours:
 *     <= 8h => 50% of daily diet
 *     > 8h  => 100% of daily diet
 *
 * Doba delegacyjna counts from departure time, NOT from midnight.
 */
function calculateMultiDayDiet(
  fullDays: number,
  remainingHours: number,
  days: DayInput[],
  rate: DomesticRateData
): DayDietResult[] {
  const results: DayDietResult[] = [];

  // Full days — each gets 100% diet
  for (let i = 0; i < fullDays; i++) {
    const day = days[i];
    if (!day) continue;

    const baseAmount = rate.dailyDiet;
    const deductions = calculateMealDeductions(day, rate);
    const finalAmount = round2(Math.max(0, baseAmount - deductions.total));

    results.push({
      dayNumber: day.dayNumber,
      hours: 24,
      baseAmount,
      deductions,
      finalAmount,
    });
  }

  // Remaining partial day (if any)
  if (remainingHours > 0 && days[fullDays]) {
    const lastDay = days[fullDays];
    let baseAmount: number;

    if (remainingHours <= 8) {
      baseAmount = round2(rate.dailyDiet * 0.5);
    } else {
      baseAmount = rate.dailyDiet;
    }

    const deductions = calculateMealDeductions(lastDay, rate);
    const finalAmount = round2(Math.max(0, baseAmount - deductions.total));

    results.push({
      dayNumber: lastDay.dayNumber,
      hours: round2(remainingHours),
      baseAmount,
      deductions,
      finalAmount,
    });
  }

  return results;
}

// =====================
// Accommodation calculation
// =====================

function calculateAccommodation(
  days: DayInput[],
  rate: DomesticRateData
): AccommodationResult {
  const nights: AccommodationNight[] = [];
  let total = 0;

  for (const day of days) {
    switch (day.accommodationType) {
      case 'RECEIPT': {
        const cost = day.accommodationCost ?? 0;
        // Cap at max receipt limit; flag if over limit (needs admin approval)
        const amount = round2(Math.min(cost, rate.accommodationMaxReceipt));
        const overLimit = cost > rate.accommodationMaxReceipt;
        nights.push({ type: 'RECEIPT', amount, overLimit });
        total += amount;
        break;
      }
      case 'LUMP_SUM': {
        const lumpSum = rate.accommodationLumpSum;
        nights.push({ type: 'LUMP_SUM', amount: lumpSum });
        total += lumpSum;
        break;
      }
      case 'FREE': {
        nights.push({ type: 'FREE', amount: 0 });
        break;
      }
      case 'NONE': {
        // No accommodation for this day — do not add to results
        break;
      }
    }
  }

  return { nights, total: round2(total) };
}

// =====================
// Transport calculation
// =====================

async function calculateTransport(
  prisma: PrismaClient,
  input: CalculationInput,
  departureDate: Date
): Promise<TransportResult> {
  let mileage: MileageResult | null = null;
  let mileageTotal = 0;
  let receiptsTotal = 0;

  // Mileage (private vehicle or mixed)
  if (
    (input.transportType === 'PRIVATE_VEHICLE' || input.transportType === 'MIXED') &&
    input.mileageDetails
  ) {
    const mileageRate = await findMileageRate(
      prisma,
      input.mileageDetails.vehicleType,
      departureDate
    );

    const distanceKm = input.mileageDetails.distanceKm;
    mileageTotal = round2(distanceKm * mileageRate.ratePerKm);

    mileage = {
      distanceKm,
      ratePerKm: mileageRate.ratePerKm,
      total: mileageTotal,
    };
  }

  // Transport receipts (public transport or mixed)
  if (
    input.transportType === 'PUBLIC_TRANSPORT' ||
    input.transportType === 'MIXED'
  ) {
    receiptsTotal = round2(
      input.transportReceipts.reduce((sum, r) => sum + r.amount, 0)
    );
  }

  const total = round2(mileageTotal + receiptsTotal);

  return {
    type: input.transportType,
    mileage,
    receipts: input.transportReceipts,
    localTransportLumpSum: 0, // Set to 0 by default; local transport lump sum is not part of the core flow for now
    total,
  };
}

// =====================
// Additional costs calculation
// =====================

function calculateAdditionalCosts(
  costs: AdditionalCostInput[]
): AdditionalCostsResult {
  const items: AdditionalCostItem[] = costs.map((c) => ({
    description: c.description,
    amount: c.amount,
  }));

  const total = round2(costs.reduce((sum, c) => sum + c.amount, 0));

  return { items, total };
}

// =====================
// Main calculation entry point
// =====================

/**
 * Calculate all components of a domestic delegation.
 *
 * This function:
 * 1. Looks up applicable rates from DB based on departure date
 * 2. Calculates duration (doba delegacyjna from departure time, NOT midnight)
 * 3. Calculates diet per day with meal deductions
 * 4. Calculates accommodation costs
 * 5. Calculates transport costs (mileage + receipts)
 * 6. Sums additional costs
 * 7. Computes grand total and amount due (grand total - advance)
 *
 * All monetary values are returned as numbers rounded to 2 decimal places.
 * In the DB and JSON responses they are serialized as strings via Decimal.
 */
export async function calculateDelegation(
  prisma: PrismaClient,
  input: CalculationInput
): Promise<CalculationResult> {
  const departureDate = new Date(input.departureAt);
  const returnDate = new Date(input.returnAt);

  // 1. Find applicable domestic rate
  const rate = await findDomesticRate(prisma, departureDate);

  // 2. Calculate duration
  const duration = calculateDuration(departureDate, returnDate);
  const { totalHours, fullDays, remainingHours } = duration;

  // 3. Calculate diet
  let dietDays: DayDietResult[];

  if (totalHours <= 24) {
    // Single-day trip
    const day = input.days[0];
    if (!day) {
      throw new Error('Wymagany co najmniej jeden dzień delegacji');
    }
    const singleResult = calculateSingleDayDiet(totalHours, day, rate);
    dietDays = [singleResult];
  } else {
    // Multi-day trip
    dietDays = calculateMultiDayDiet(fullDays, remainingHours, input.days, rate);
  }

  const dietTotal = round2(dietDays.reduce((sum, d) => sum + d.finalAmount, 0));

  const dietResult: DietResult = {
    rateUsed: rate.dailyDiet,
    days: dietDays,
    total: dietTotal,
  };

  // 4. Calculate accommodation
  const accommodationResult = calculateAccommodation(input.days, rate);

  // 5. Calculate transport
  const transportResult = await calculateTransport(prisma, input, departureDate);

  // 6. Calculate additional costs
  const additionalCostsResult = calculateAdditionalCosts(input.additionalCosts);

  // 7. Summary
  const grandTotal = round2(
    dietTotal +
      accommodationResult.total +
      transportResult.total +
      additionalCostsResult.total
  );

  const advanceAmount = input.advanceAmount;
  // amountDue can be negative if advance > total (delegated returns the difference)
  const amountDue = round2(grandTotal - advanceAmount);

  const summary: SummaryResult = {
    dietTotal,
    accommodationTotal: accommodationResult.total,
    transportTotal: transportResult.total,
    additionalTotal: additionalCostsResult.total,
    grandTotal,
    advanceAmount,
    amountDue,
  };

  return {
    duration: {
      totalHours: round2(totalHours),
      fullDays,
      remainingHours: round2(remainingHours),
    },
    diet: dietResult,
    accommodation: accommodationResult,
    transport: transportResult,
    additionalCosts: additionalCostsResult,
    summary,
  };
}
