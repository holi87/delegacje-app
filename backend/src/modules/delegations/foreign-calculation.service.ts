import { PrismaClient } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import { fetchNbpRate } from '../nbp/nbp.service.js';

// =====================
// Types
// =====================

interface DayInput {
  dayNumber: number;
  date: string;
  isForeign: boolean;
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

export interface ForeignDelegationInput {
  departureAt: string;
  returnAt: string;
  borderCrossingOut: string;
  borderCrossingIn: string;
  foreignCountry: string;
  transportType: 'COMPANY_VEHICLE' | 'PUBLIC_TRANSPORT' | 'PRIVATE_VEHICLE' | 'MIXED';
  vehicleType?: 'CAR_ABOVE_900' | 'CAR_BELOW_900' | 'MOTORCYCLE' | 'MOPED' | null;
  advanceAmount: number;
  days: DayInput[];
  mileageDetails?: MileageInput | null;
  transportReceipts: TransportReceiptInput[];
  additionalCosts: AdditionalCostInput[];
}

// Calculation result types

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

interface DomesticDietResult {
  rateUsed: number;
  days: DayDietResult[];
  total: number;
}

interface ForeignDietResult {
  rateUsed: number;
  currency: string;
  countryCode: string;
  countryName: string;
  days: DayDietResult[];
  total: number;
}

interface AccommodationNight {
  type: string;
  amount: number;
  isForeign: boolean;
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

interface ForeignSummaryResult {
  domesticDietTotal: number; // PLN
  foreignDietTotal: number; // foreign currency
  foreignDietTotalPln: number; // PLN
  dietTotal: number; // PLN
  domesticAccommodationTotal: number; // PLN
  foreignAccommodationTotal: number; // foreign currency
  foreignAccommodationTotalPln: number; // PLN
  accommodationTotal: number; // PLN
  transportTotal: number;
  additionalTotal: number;
  grandTotal: number; // PLN
  advanceAmount: number;
  amountDue: number; // PLN
  exchangeRate: number;
  exchangeRateDate: string;
  exchangeRateTable: string;
  foreignCurrency: string;
}

export interface ForeignCalculationResult {
  duration: {
    totalHours: number;
    domesticHours: number;
    foreignHours: number;
  };
  diet: {
    domesticDays: DayDietResult[];
    foreignDays: DayDietResult[];
    domesticTotal: number;
    foreignTotal: number;
    total: number;
    foreignCurrency: string;
  };
  accommodation: AccommodationResult;
  transport: TransportResult;
  additionalCosts: AdditionalCostsResult;
  summary: ForeignSummaryResult;
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

interface ForeignRateData {
  id: string;
  countryCode: string;
  countryName: string;
  currency: string;
  dailyDiet: number;
  accommodationLimit: number;
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
 * Find the applicable foreign diet rate for a given country code and departure date.
 * Rates are looked up from DB by country code and valid date range.
 */
export async function findForeignRate(
  prisma: PrismaClient,
  countryCode: string,
  departureAt: Date
): Promise<ForeignRateData> {
  const rate = await prisma.foreignDietRate.findFirst({
    where: {
      countryCode,
      validFrom: { lte: departureAt },
      OR: [{ validTo: null }, { validTo: { gte: departureAt } }],
    },
    orderBy: { validFrom: 'desc' },
  });

  if (!rate) {
    throw new Error(
      `Nie znaleziono obowiązujących stawek diety zagranicznej dla kraju ${countryCode} i daty wyjazdu`
    );
  }

  return {
    id: rate.id,
    countryCode: rate.countryCode,
    countryName: rate.countryName,
    currency: rate.currency,
    dailyDiet: decimalToNumber(rate.dailyDiet),
    accommodationLimit: decimalToNumber(rate.accommodationLimit),
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
// Domestic diet calculation (for the domestic segment of a foreign trip)
// =====================

/**
 * Calculate meal deductions for a single domestic day.
 * CRITICAL RULE: Deductions are ALWAYS calculated from the FULL daily diet (e.g. 45 PLN),
 * even if only 50% of the diet applies for that day.
 */
function calculateDomesticMealDeductions(
  day: DayInput,
  rate: DomesticRateData
): DayDietDeductions {
  const fullDiet = rate.dailyDiet;

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
 * Calculate domestic diet for the domestic segment of a foreign delegation.
 *
 * The domestic segment consists of two parts:
 *   - From departureAt to borderCrossingOut (outbound)
 *   - From borderCrossingIn to returnAt (inbound)
 *
 * These two parts are COMBINED to form the total domestic duration.
 * Then domestic rules apply:
 *   Single-day (<=24h total domestic):
 *     < 8h  => 0
 *     8-12h => 50%
 *     > 12h => 100%
 *   Multi-day (>24h total domestic):
 *     Each full 24h => 100%
 *     Remaining:
 *       <= 8h => 50%
 *       > 8h  => 100%
 */
function calculateDomesticSegmentDiet(
  domesticHours: number,
  domesticDays: DayInput[],
  rate: DomesticRateData
): DayDietResult[] {
  if (domesticDays.length === 0 || domesticHours <= 0) {
    return [];
  }

  const { fullDays, remainingHours } = breakdownHours(domesticHours);

  if (domesticHours <= 24) {
    // Single-day domestic segment
    const day = domesticDays[0];
    if (!day) return [];

    let baseAmount: number;
    if (domesticHours < 8) {
      baseAmount = 0;
    } else if (domesticHours <= 12) {
      baseAmount = round2(rate.dailyDiet * 0.5);
    } else {
      baseAmount = rate.dailyDiet;
    }

    if (baseAmount === 0) {
      return [
        {
          dayNumber: day.dayNumber,
          hours: round2(domesticHours),
          baseAmount: 0,
          deductions: { breakfast: 0, lunch: 0, dinner: 0, total: 0 },
          finalAmount: 0,
        },
      ];
    }

    const deductions = calculateDomesticMealDeductions(day, rate);
    const finalAmount = round2(Math.max(0, baseAmount - deductions.total));

    return [
      {
        dayNumber: day.dayNumber,
        hours: round2(domesticHours),
        baseAmount,
        deductions,
        finalAmount,
      },
    ];
  }

  // Multi-day domestic segment
  const results: DayDietResult[] = [];

  for (let i = 0; i < fullDays; i++) {
    const day = domesticDays[i];
    if (!day) continue;

    const baseAmount = rate.dailyDiet;
    const deductions = calculateDomesticMealDeductions(day, rate);
    const finalAmount = round2(Math.max(0, baseAmount - deductions.total));

    results.push({
      dayNumber: day.dayNumber,
      hours: 24,
      baseAmount,
      deductions,
      finalAmount,
    });
  }

  if (remainingHours > 0 && domesticDays[fullDays]) {
    const lastDay = domesticDays[fullDays];
    let baseAmount: number;

    if (remainingHours <= 8) {
      baseAmount = round2(rate.dailyDiet * 0.5);
    } else {
      baseAmount = rate.dailyDiet;
    }

    const deductions = calculateDomesticMealDeductions(lastDay, rate);
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
// Foreign diet calculation
// =====================

/**
 * Calculate meal deductions for a single foreign day.
 * Foreign deduction percentages differ from domestic:
 *   breakfast: 15% (default), lunch: 30%, dinner: 30%
 * Deductions are calculated from the FULL foreign daily diet.
 */
function calculateForeignMealDeductions(
  day: DayInput,
  rate: ForeignRateData
): DayDietDeductions {
  const fullDiet = rate.dailyDiet;

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
 * Calculate foreign diet for the foreign segment.
 *
 * Foreign time thresholds differ from domestic:
 *   Single-day foreign trip (<=24h of foreign segment):
 *     <= 8h  => 1/3 of daily diet
 *     8-12h  => 1/2 of daily diet
 *     > 12h  => 100% of daily diet
 *   Multi-day foreign trip (>24h of foreign segment):
 *     Each full 24h => 100%
 *     Remaining partial day:
 *       <= 8h => 1/3 of daily diet
 *       > 8h  => 1/2 of daily diet
 */
function calculateForeignSegmentDiet(
  foreignHours: number,
  foreignDays: DayInput[],
  rate: ForeignRateData
): DayDietResult[] {
  if (foreignDays.length === 0 || foreignHours <= 0) {
    return [];
  }

  const { fullDays, remainingHours } = breakdownHours(foreignHours);

  if (foreignHours <= 24) {
    // Single-day foreign segment
    const day = foreignDays[0];
    if (!day) return [];

    let baseAmount: number;
    if (foreignHours <= 8) {
      baseAmount = round2(rate.dailyDiet / 3);
    } else if (foreignHours <= 12) {
      baseAmount = round2(rate.dailyDiet * 0.5);
    } else {
      baseAmount = rate.dailyDiet;
    }

    const deductions = calculateForeignMealDeductions(day, rate);
    const finalAmount = round2(Math.max(0, baseAmount - deductions.total));

    return [
      {
        dayNumber: day.dayNumber,
        hours: round2(foreignHours),
        baseAmount,
        deductions,
        finalAmount,
      },
    ];
  }

  // Multi-day foreign segment
  const results: DayDietResult[] = [];

  for (let i = 0; i < fullDays; i++) {
    const day = foreignDays[i];
    if (!day) continue;

    const baseAmount = rate.dailyDiet;
    const deductions = calculateForeignMealDeductions(day, rate);
    const finalAmount = round2(Math.max(0, baseAmount - deductions.total));

    results.push({
      dayNumber: day.dayNumber,
      hours: 24,
      baseAmount,
      deductions,
      finalAmount,
    });
  }

  // Remaining partial day for multi-day foreign trip
  if (remainingHours > 0 && foreignDays[fullDays]) {
    const lastDay = foreignDays[fullDays];
    let baseAmount: number;

    if (remainingHours <= 8) {
      baseAmount = round2(rate.dailyDiet / 3);
    } else {
      baseAmount = round2(rate.dailyDiet * 0.5);
    }

    const deductions = calculateForeignMealDeductions(lastDay, rate);
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

/**
 * Calculate accommodation for foreign delegation.
 * Foreign days use the country's accommodationLimit instead of domestic rates.
 * Foreign lump sum = 25% of country's accommodationLimit.
 */
function calculateForeignAccommodation(
  days: DayInput[],
  domesticRate: DomesticRateData,
  foreignRate: ForeignRateData
): AccommodationResult {
  const nights: AccommodationNight[] = [];
  let total = 0;

  for (const day of days) {
    const isForeign = day.isForeign;

    switch (day.accommodationType) {
      case 'RECEIPT': {
        const cost = day.accommodationCost ?? 0;

        if (isForeign) {
          // Foreign: cap at country's accommodationLimit
          const maxReceipt = foreignRate.accommodationLimit;
          const amount = round2(Math.min(cost, maxReceipt));
          const overLimit = cost > maxReceipt;
          nights.push({ type: 'RECEIPT', amount, isForeign: true, overLimit });
          total += amount;
        } else {
          // Domestic: cap at domestic max receipt
          const maxReceipt = domesticRate.accommodationMaxReceipt;
          const amount = round2(Math.min(cost, maxReceipt));
          const overLimit = cost > maxReceipt;
          nights.push({ type: 'RECEIPT', amount, isForeign: false, overLimit });
          total += amount;
        }
        break;
      }
      case 'LUMP_SUM': {
        if (isForeign) {
          // Foreign lump sum: 25% of country's accommodationLimit
          const lumpSum = round2(foreignRate.accommodationLimit * 0.25);
          nights.push({ type: 'LUMP_SUM', amount: lumpSum, isForeign: true });
          total += lumpSum;
        } else {
          // Domestic lump sum
          const lumpSum = domesticRate.accommodationLumpSum;
          nights.push({ type: 'LUMP_SUM', amount: lumpSum, isForeign: false });
          total += lumpSum;
        }
        break;
      }
      case 'FREE': {
        nights.push({ type: 'FREE', amount: 0, isForeign });
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
  input: ForeignDelegationInput,
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
    localTransportLumpSum: 0,
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
// Duration helpers
// =====================

/**
 * Break total hours into full 24h periods and remaining hours.
 */
function breakdownHours(totalHours: number): { fullDays: number; remainingHours: number } {
  const fullDays = Math.floor(totalHours / 24);
  const remainingHours = totalHours - fullDays * 24;
  return { fullDays, remainingHours };
}

/**
 * Calculate the number of hours between two Date objects.
 */
function hoursBetween(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60 * 60);
}

// =====================
// Main calculation entry point
// =====================

/**
 * Calculate all components of a foreign delegation.
 *
 * A foreign delegation has TWO segments:
 * 1. Domestic segment: departureAt → borderCrossingOut + borderCrossingIn → returnAt
 *    - Calculated using DOMESTIC rates and rules
 * 2. Foreign segment: borderCrossingOut → borderCrossingIn
 *    - Calculated using FOREIGN rates (from ForeignDietRate table by country)
 *
 * The result combines both segments into a unified calculation.
 *
 * All monetary values are returned as numbers rounded to 2 decimal places.
 */
export async function calculateForeignDelegation(
  prisma: PrismaClient,
  input: ForeignDelegationInput
): Promise<ForeignCalculationResult> {
  const departureDate = new Date(input.departureAt);
  const returnDate = new Date(input.returnAt);
  const borderOut = new Date(input.borderCrossingOut);
  const borderIn = new Date(input.borderCrossingIn);

  // Validate border crossing times
  if (borderOut <= departureDate) {
    throw new Error('Czas przekroczenia granicy (wyjazd) musi być po dacie wyjazdu');
  }
  if (borderIn >= returnDate) {
    throw new Error('Czas przekroczenia granicy (powrót) musi być przed datą powrotu');
  }
  if (borderIn <= borderOut) {
    throw new Error('Czas powrotu przez granicę musi być po czasie wyjazdu za granicę');
  }

  // 1. Find applicable rates
  const domesticRate = await findDomesticRate(prisma, departureDate);
  const foreignRate = await findForeignRate(prisma, input.foreignCountry, departureDate);

  // 2. Calculate durations for each segment
  const totalHours = hoursBetween(departureDate, returnDate);

  // Domestic segment: (departure → borderOut) + (borderIn → return)
  const domesticOutboundHours = hoursBetween(departureDate, borderOut);
  const domesticInboundHours = hoursBetween(borderIn, returnDate);
  const domesticHours = round2(domesticOutboundHours + domesticInboundHours);

  // Foreign segment: borderOut → borderIn
  const foreignHours = round2(hoursBetween(borderOut, borderIn));

  // 3. Split days into domestic and foreign based on isForeign flag
  const domesticDays = input.days.filter((d) => !d.isForeign);
  const foreignDays = input.days.filter((d) => d.isForeign);

  // 4. Calculate diet for each segment
  const domesticDietDays = calculateDomesticSegmentDiet(domesticHours, domesticDays, domesticRate);
  const foreignDietDays = calculateForeignSegmentDiet(foreignHours, foreignDays, foreignRate);

  const domesticDietTotal = round2(
    domesticDietDays.reduce((sum, d) => sum + d.finalAmount, 0)
  );
  const foreignDietTotal = round2(
    foreignDietDays.reduce((sum, d) => sum + d.finalAmount, 0)
  );

  // 5. Calculate accommodation (handles both domestic and foreign nights)
  const accommodationResult = calculateForeignAccommodation(
    input.days,
    domesticRate,
    foreignRate
  );

  // 6. Calculate transport
  const transportResult = await calculateTransport(prisma, input, departureDate);

  // 7. Calculate additional costs
  const additionalCostsResult = calculateAdditionalCosts(input.additionalCosts);

  // 8. Currency conversion (foreign parts -> PLN)
  const nbpRate = await fetchNbpRate(foreignRate.currency, new Date());

  const foreignDietTotalPln = round2(foreignDietTotal * nbpRate.rate);
  const dietTotal = round2(domesticDietTotal + foreignDietTotalPln);

  const domesticAccommodationTotal = round2(
    accommodationResult.nights
      .filter((night) => !night.isForeign)
      .reduce((sum, night) => sum + night.amount, 0)
  );
  const foreignAccommodationTotal = round2(
    accommodationResult.nights
      .filter((night) => night.isForeign)
      .reduce((sum, night) => sum + night.amount, 0)
  );
  const foreignAccommodationTotalPln = round2(
    foreignAccommodationTotal * nbpRate.rate
  );
  const accommodationTotal = round2(
    domesticAccommodationTotal + foreignAccommodationTotalPln
  );

  // 9. Summary (all totals in PLN)
  const grandTotal = round2(
    dietTotal +
      accommodationTotal +
      transportResult.total +
      additionalCostsResult.total
  );

  const advanceAmount = input.advanceAmount;
  // amountDue can be negative if advance > total (delegated returns the difference)
  const amountDue = round2(grandTotal - advanceAmount);

  const summary: ForeignSummaryResult = {
    domesticDietTotal,
    foreignDietTotal,
    foreignDietTotalPln,
    dietTotal,
    domesticAccommodationTotal,
    foreignAccommodationTotal,
    foreignAccommodationTotalPln,
    accommodationTotal,
    transportTotal: transportResult.total,
    additionalTotal: additionalCostsResult.total,
    grandTotal,
    advanceAmount,
    amountDue,
    exchangeRate: nbpRate.rate,
    exchangeRateDate: nbpRate.effectiveDate,
    exchangeRateTable: nbpRate.tableNo,
    foreignCurrency: foreignRate.currency,
  };

  return {
    duration: {
      totalHours: round2(totalHours),
      domesticHours,
      foreignHours,
    },
    diet: {
      domesticDays: domesticDietDays,
      foreignDays: foreignDietDays,
      domesticTotal: domesticDietTotal,
      foreignTotal: foreignDietTotal,
      total: dietTotal,
      foreignCurrency: foreignRate.currency,
    },
    accommodation: accommodationResult,
    transport: transportResult,
    additionalCosts: additionalCostsResult,
    summary,
  };
}
