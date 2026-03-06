import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateForeignDelegation, ForeignDelegationInput } from '../src/modules/delegations/foreign-calculation.service.js';

// =====================
// Mock Prisma Client
// =====================

const mockPrisma = {
  domesticRate: {
    findFirst: vi.fn(),
  },
  foreignDietRate: {
    findFirst: vi.fn(),
  },
  mileageRate: {
    findFirst: vi.fn(),
  },
} as any;

// Default domestic rate (same as Polish law defaults)
const defaultDomesticRate = {
  id: 'dr-1',
  dailyDiet: { toString: () => '45' } as any,
  accommodationLumpSum: { toString: () => '67.50' } as any,
  accommodationMaxReceipt: { toString: () => '900' } as any,
  localTransportLumpSum: { toString: () => '9' } as any,
  breakfastDeductionPct: 25,
  lunchDeductionPct: 50,
  dinnerDeductionPct: 25,
};

// Default foreign rate (Germany example)
const defaultForeignRate = {
  id: 'fr-de',
  countryCode: 'DE',
  countryName: 'Niemcy',
  currency: 'EUR',
  dailyDiet: { toString: () => '49' } as any,
  accommodationLimit: { toString: () => '150' } as any,
  breakfastDeductionPct: 15,
  lunchDeductionPct: 30,
  dinnerDeductionPct: 30,
};

const defaultMileageRate = {
  id: 'mr-1',
  ratePerKm: { toString: () => '0.89' } as any,
};

function setupMocks() {
  mockPrisma.domesticRate.findFirst.mockResolvedValue(defaultDomesticRate);
  mockPrisma.foreignDietRate.findFirst.mockResolvedValue(defaultForeignRate);
  mockPrisma.mileageRate.findFirst.mockResolvedValue(defaultMileageRate);
}

// =====================
// Tests
// =====================

describe('Foreign Delegation Calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // =====================
  // Duration calculation
  // =====================

  describe('Duration segments', () => {
    it('should calculate domestic and foreign hours correctly', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',  // departure from Poland
        returnAt: '2024-06-12T20:00:00.000Z',       // return to Poland
        borderCrossingOut: '2024-06-10T10:00:00.000Z', // leave Poland after 4h
        borderCrossingIn: '2024-06-12T16:00:00.000Z',  // re-enter Poland, 4h before return
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: false, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
          { dayNumber: 2, date: '2024-06-11', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
          { dayNumber: 3, date: '2024-06-12', isForeign: false, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Total: 62 hours (June 10 6:00 to June 12 20:00)
      expect(result.duration.totalHours).toBe(62);
      // Domestic: 4h outbound (6:00-10:00) + 4h inbound (16:00-20:00) = 8h
      expect(result.duration.domesticHours).toBe(8);
      // Foreign: 54h (June 10 10:00 to June 12 16:00)
      expect(result.duration.foreignHours).toBe(54);
    });
  });

  // =====================
  // Foreign diet thresholds
  // =====================

  describe('Foreign diet thresholds', () => {
    it('should give 1/3 diet for foreign segment <= 8h', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-10T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T08:00:00.000Z',
        borderCrossingIn: '2024-06-10T14:00:00.000Z', // 6h foreign
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Foreign 6h => 1/3 of 49 EUR = 16.33
      expect(result.diet.foreignDays.length).toBe(1);
      expect(result.diet.foreignDays[0].baseAmount).toBeCloseTo(16.33, 1);
    });

    it('should give 1/2 diet for foreign segment 8-12h', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-10T22:00:00.000Z',
        borderCrossingOut: '2024-06-10T07:00:00.000Z',
        borderCrossingIn: '2024-06-10T17:00:00.000Z', // 10h foreign
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Foreign 10h => 1/2 of 49 EUR = 24.50
      expect(result.diet.foreignDays.length).toBe(1);
      expect(result.diet.foreignDays[0].baseAmount).toBeCloseTo(24.50, 1);
    });

    it('should give 100% diet for foreign segment > 12h', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-11T06:00:00.000Z',
        borderCrossingOut: '2024-06-10T07:00:00.000Z',
        borderCrossingIn: '2024-06-10T21:00:00.000Z', // 14h foreign
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Foreign 14h => 100% of 49 EUR = 49
      expect(result.diet.foreignDays.length).toBe(1);
      expect(result.diet.foreignDays[0].baseAmount).toBe(49);
    });
  });

  // =====================
  // Foreign meal deductions
  // =====================

  describe('Foreign meal deductions', () => {
    it('should deduct 15% for breakfast, 30% for lunch, 30% for dinner', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-11T22:00:00.000Z',
        borderCrossingOut: '2024-06-10T07:00:00.000Z',
        borderCrossingIn: '2024-06-11T21:00:00.000Z', // 38h foreign
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: true, lunchProvided: true, dinnerProvided: true, accommodationType: 'NONE', accommodationCost: null },
          { dayNumber: 2, date: '2024-06-11', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Day 1: full 24h => 100% = 49 EUR; deductions: 15% + 30% + 30% = 75% of 49 = 36.75
      const day1 = result.diet.foreignDays[0];
      expect(day1.baseAmount).toBe(49);
      expect(day1.deductions.breakfast).toBeCloseTo(7.35, 1); // 49 * 0.15
      expect(day1.deductions.lunch).toBeCloseTo(14.7, 1);     // 49 * 0.30
      expect(day1.deductions.dinner).toBeCloseTo(14.7, 1);    // 49 * 0.30
      expect(day1.finalAmount).toBeCloseTo(12.25, 1);          // 49 - 36.75
    });

    it('should clamp foreign diet to 0 when all meal deductions exceed base amount', async () => {
      // Use a rate where deductions sum to 75% — not enough to exceed 1/3 base.
      // But with 1/3 diet (16.33) and 75% deductions (36.75), it should clamp to 0.
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-10T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T08:00:00.000Z',
        borderCrossingIn: '2024-06-10T14:00:00.000Z', // 6h foreign => 1/3 diet
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: true, lunchProvided: true, dinnerProvided: true, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // 1/3 of 49 = 16.33, deductions = 75% of 49 = 36.75
      // finalAmount = max(0, 16.33 - 36.75) = 0
      const day1 = result.diet.foreignDays[0];
      expect(day1.baseAmount).toBeCloseTo(16.33, 1);
      expect(day1.finalAmount).toBe(0);
    });

    it('should deduct only breakfast (15%) when only breakfast is provided', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-11T06:00:00.000Z',
        borderCrossingOut: '2024-06-10T07:00:00.000Z',
        borderCrossingIn: '2024-06-10T21:00:00.000Z', // 14h foreign => 100%
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: true, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      const day1 = result.diet.foreignDays[0];
      expect(day1.baseAmount).toBe(49);
      expect(day1.deductions.breakfast).toBeCloseTo(7.35, 1); // 49 * 0.15
      expect(day1.deductions.lunch).toBe(0);
      expect(day1.deductions.dinner).toBe(0);
      expect(day1.finalAmount).toBeCloseTo(41.65, 1); // 49 - 7.35
    });
  });

  // =====================
  // Domestic segment of foreign delegation
  // =====================

  describe('Domestic segment', () => {
    it('should calculate domestic diet with domestic rules for the Polish segment', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-10T22:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-10T18:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: false, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
          { dayNumber: 2, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Domestic segment: 4h outbound (6:00-10:00) + 4h inbound (18:00-22:00) = 8h
      // 8h domestic => 50% of 45 PLN = 22.50
      expect(result.duration.domesticHours).toBe(8);
      expect(result.diet.domesticDays.length).toBe(1);
      expect(result.diet.domesticDays[0].baseAmount).toBeCloseTo(22.50, 1);
    });

    it('should give 0 diet for domestic segment < 8h', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T08:00:00.000Z',
        returnAt: '2024-06-10T22:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-10T20:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: false, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
          { dayNumber: 2, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Domestic segment: 2h outbound (8:00-10:00) + 2h inbound (20:00-22:00) = 4h
      // 4h domestic => 0 PLN (below 8h threshold)
      expect(result.duration.domesticHours).toBe(4);
      expect(result.diet.domesticDays.length).toBe(1);
      expect(result.diet.domesticDays[0].baseAmount).toBe(0);
      expect(result.diet.domesticDays[0].finalAmount).toBe(0);
    });

    it('should give 100% domestic diet for domestic segment > 12h', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T02:00:00.000Z',
        returnAt: '2024-06-10T23:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-10T11:00:00.000Z', // 1h foreign
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: false, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
          { dayNumber: 2, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Domestic: 8h outbound (2:00-10:00) + 12h inbound (11:00-23:00) = 20h
      // 20h domestic (>12h) => 100% of 45 PLN = 45
      expect(result.duration.domesticHours).toBe(20);
      expect(result.diet.domesticDays.length).toBe(1);
      expect(result.diet.domesticDays[0].baseAmount).toBe(45);
      expect(result.diet.domesticDays[0].finalAmount).toBe(45);
    });

    it('should apply domestic meal deductions from full domestic diet', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-10T22:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-10T18:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: false, breakfastProvided: false, lunchProvided: true, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
          { dayNumber: 2, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Domestic: 8h => 50% of 45 = 22.50
      // Lunch deduction: 50% of FULL 45 = 22.50
      // finalAmount = max(0, 22.50 - 22.50) = 0
      expect(result.diet.domesticDays[0].baseAmount).toBeCloseTo(22.50, 1);
      expect(result.diet.domesticDays[0].deductions.lunch).toBeCloseTo(22.50, 1);
      expect(result.diet.domesticDays[0].finalAmount).toBe(0);
    });
  });

  // =====================
  // Foreign accommodation
  // =====================

  describe('Foreign accommodation', () => {
    it('should use foreign accommodation limit for RECEIPT on foreign days', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-12T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-12T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'RECEIPT', accommodationCost: 200 },
          { dayNumber: 2, date: '2024-06-11', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'LUMP_SUM', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Day 1: RECEIPT 200, capped at foreign limit 150
      expect(result.accommodation.nights[0].amount).toBe(150);
      expect(result.accommodation.nights[0].isForeign).toBe(true);
      expect(result.accommodation.nights[0].overLimit).toBe(true);

      // Day 2: LUMP_SUM = 25% of 150 = 37.50
      expect(result.accommodation.nights[1].amount).toBeCloseTo(37.50, 1);
      expect(result.accommodation.nights[1].isForeign).toBe(true);

      // Total: 150 + 37.50 = 187.50
      expect(result.accommodation.total).toBeCloseTo(187.50, 1);
    });

    it('should accept foreign receipt within the limit without overLimit flag', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-12T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-12T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'RECEIPT', accommodationCost: 120 },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // 120 < 150 limit, so full amount used
      expect(result.accommodation.nights[0].amount).toBe(120);
      expect(result.accommodation.nights[0].isForeign).toBe(true);
      expect(result.accommodation.nights[0].overLimit).toBe(false);
    });

    it('should use domestic accommodation rates for domestic days', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-12T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-12T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: false, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'RECEIPT', accommodationCost: 500 },
          { dayNumber: 2, date: '2024-06-11', isForeign: false, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'LUMP_SUM', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Domestic RECEIPT: 500, capped at domestic limit 900 => 500
      expect(result.accommodation.nights[0].amount).toBe(500);
      expect(result.accommodation.nights[0].isForeign).toBe(false);
      expect(result.accommodation.nights[0].overLimit).toBe(false);

      // Domestic LUMP_SUM: 67.50
      expect(result.accommodation.nights[1].amount).toBe(67.5);
      expect(result.accommodation.nights[1].isForeign).toBe(false);

      expect(result.accommodation.total).toBe(567.5);
    });

    it('should return 0 for FREE accommodation on foreign days', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-12T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-12T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'FREE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      expect(result.accommodation.nights[0].type).toBe('FREE');
      expect(result.accommodation.nights[0].amount).toBe(0);
      expect(result.accommodation.nights[0].isForeign).toBe(true);
      expect(result.accommodation.total).toBe(0);
    });

    it('should not add nights for NONE accommodation type', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-12T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-12T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
          { dayNumber: 2, date: '2024-06-11', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      expect(result.accommodation.nights).toHaveLength(0);
      expect(result.accommodation.total).toBe(0);
    });
  });

  // =====================
  // Transport calculation
  // =====================

  describe('Transport', () => {
    it('should return 0 transport cost for company vehicle', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-11T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-11T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      expect(result.transport.mileage).toBeNull();
      expect(result.transport.total).toBe(0);
    });

    it('should calculate mileage for private vehicle', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-11T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-11T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'PRIVATE_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: {
          vehicleType: 'CAR_ABOVE_900',
          vehiclePlate: 'WA 12345',
          segments: [{ date: '2024-06-10', startLocation: 'Warszawa', endLocation: 'Berlin', km: 500 }],
        },
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // 500 * 0.89 = 445
      expect(result.transport.mileage).not.toBeNull();
      expect(result.transport.mileage!.distanceKm).toBe(500);
      expect(result.transport.mileage!.ratePerKm).toBe(0.89);
      expect(result.transport.mileage!.total).toBe(445);
      expect(result.transport.total).toBe(445);
    });

    it('should choose <= 900 car mileage rate when engine capacity is 900 cm3', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-11T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-11T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'PRIVATE_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: {
          vehicleType: 'CAR_ABOVE_900',
          engineCapacityCm3: 900,
          vehiclePlate: 'WA 12345',
          segments: [{ date: '2024-06-10', startLocation: 'A', endLocation: 'B', km: 50 }],
        },
        transportReceipts: [],
        additionalCosts: [],
      };

      await calculateForeignDelegation(mockPrisma, input);

      expect(mockPrisma.mileageRate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vehicleType: 'CAR_BELOW_900',
          }),
        })
      );
    });

    it('should sum transport receipts for public transport', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-11T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-11T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'PUBLIC_TRANSPORT',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [
          { description: 'Pociag Berlin', amount: 200, receiptNumber: 'R001' },
          { description: 'U-Bahn', amount: 15.50, receiptNumber: 'R002' },
        ],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      expect(result.transport.mileage).toBeNull();
      expect(result.transport.receipts).toHaveLength(2);
      expect(result.transport.total).toBe(215.5);
    });

    it('should combine mileage and receipts for mixed transport', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-11T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-11T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'MIXED',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: {
          vehicleType: 'CAR_ABOVE_900',
          vehiclePlate: 'WA 12345',
          segments: [{ date: '2024-06-10', startLocation: 'A', endLocation: 'B', km: 200 }],
        },
        transportReceipts: [
          { description: 'Taxi', amount: 50, receiptNumber: null },
        ],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Mileage: 200 * 0.89 = 178
      // Receipts: 50
      // Total: 228
      expect(result.transport.mileage!.total).toBe(178);
      expect(result.transport.total).toBe(228);
    });
  });

  // =====================
  // Additional costs
  // =====================

  describe('Additional costs', () => {
    it('should sum all additional costs', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-11T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-11T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [
          { description: 'Parking', category: 'PARKING', amount: 25 },
          { description: 'Autostrada', category: 'TOLL', amount: 45.50 },
          { description: 'Materialy', category: 'OTHER', amount: 12.30 },
        ],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      expect(result.additionalCosts.items).toHaveLength(3);
      expect(result.additionalCosts.total).toBe(82.8);
    });

    it('should return 0 when no additional costs provided', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-11T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-11T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      expect(result.additionalCosts.items).toHaveLength(0);
      expect(result.additionalCosts.total).toBe(0);
    });
  });

  // =====================
  // Summary and advance
  // =====================

  describe('Summary', () => {
    it('should compute correct grand total and amount due', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-11T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-11T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 100,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: false, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
          { dayNumber: 2, date: '2024-06-11', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [
          { description: 'Taxi', category: 'Transport', amount: 30 },
        ],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      expect(result.summary.advanceAmount).toBe(100);
      expect(result.summary.additionalTotal).toBe(30);

      // grandTotal = diet + accommodation + transport + additional
      const expectedGrand = result.summary.dietTotal + result.summary.accommodationTotal + result.summary.transportTotal + result.summary.additionalTotal;
      expect(result.summary.grandTotal).toBeCloseTo(expectedGrand, 1);

      // amountDue = grandTotal - advance
      expect(result.summary.amountDue).toBeCloseTo(result.summary.grandTotal - 100, 1);
    });

    it('should return negative amountDue when advance exceeds total', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-11T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-11T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 5000,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Grand total is small (just diet), advance is 5000
      expect(result.summary.amountDue).toBeLessThan(0);
      expect(result.summary.amountDue).toBe(result.summary.grandTotal - 5000);
    });

    it('should separate domestic and foreign diet totals in summary', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-10T22:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-10T18:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: false, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
          { dayNumber: 2, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Domestic: 8h => 50% of 45 = 22.50
      expect(result.summary.domesticDietTotal).toBeCloseTo(22.50, 1);
      // Foreign: 8h => <=8h => 1/3 of 49 = 16.33
      expect(result.summary.foreignDietTotal).toBeCloseTo(16.33, 1);
      // Combined: 22.50 + 16.33 = 38.83
      expect(result.summary.dietTotal).toBeCloseTo(38.83, 1);
    });
  });

  // =====================
  // Validation errors
  // =====================

  describe('Validation', () => {
    it('should throw if border crossing out is before departure', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T10:00:00.000Z',
        returnAt: '2024-06-11T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T08:00:00.000Z', // before departure!
        borderCrossingIn: '2024-06-11T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      await expect(calculateForeignDelegation(mockPrisma, input)).rejects.toThrow();
    });

    it('should throw if border crossing in is after return', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-11T16:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-11T18:00:00.000Z', // after return!
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      await expect(calculateForeignDelegation(mockPrisma, input)).rejects.toThrow();
    });

    it('should throw if border crossing in is before border crossing out', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-11T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T14:00:00.000Z',
        borderCrossingIn: '2024-06-10T12:00:00.000Z', // before border out!
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      await expect(calculateForeignDelegation(mockPrisma, input)).rejects.toThrow();
    });

    it('should throw if border crossing out equals departure (must be strictly after)', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T10:00:00.000Z',
        returnAt: '2024-06-11T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z', // equals departure
        borderCrossingIn: '2024-06-11T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      await expect(calculateForeignDelegation(mockPrisma, input)).rejects.toThrow();
    });
  });

  // =====================
  // Missing rates
  // =====================

  describe('Missing rates', () => {
    it('should throw when no applicable domestic rate is found', async () => {
      mockPrisma.domesticRate.findFirst.mockResolvedValue(null);

      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-11T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-11T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      await expect(calculateForeignDelegation(mockPrisma, input)).rejects.toThrow(
        'Nie znaleziono obowiązujących stawek diety krajowej'
      );
    });

    it('should throw when no applicable foreign rate is found for country', async () => {
      mockPrisma.foreignDietRate.findFirst.mockResolvedValue(null);

      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-11T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-11T16:00:00.000Z',
        foreignCountry: 'XX',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      await expect(calculateForeignDelegation(mockPrisma, input)).rejects.toThrow(
        'Nie znaleziono obowiązujących stawek diety zagranicznej dla kraju XX'
      );
    });

    it('should throw when no applicable mileage rate is found for private vehicle', async () => {
      mockPrisma.mileageRate.findFirst.mockResolvedValue(null);

      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-11T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-11T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'PRIVATE_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: {
          vehicleType: 'CAR_ABOVE_900',
          vehiclePlate: 'WA 12345',
          segments: [{ date: '2024-06-10', startLocation: 'A', endLocation: 'B', km: 100 }],
        },
        transportReceipts: [],
        additionalCosts: [],
      };

      await expect(calculateForeignDelegation(mockPrisma, input)).rejects.toThrow(
        'Nie znaleziono obowiązujących stawek kilometrówki'
      );
    });
  });

  // =====================
  // Multi-day foreign trip
  // =====================

  describe('Multi-day foreign segment', () => {
    it('should calculate multi-day foreign with partial last day', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-13T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-13T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
          { dayNumber: 2, date: '2024-06-11', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
          { dayNumber: 3, date: '2024-06-12', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
          { dayNumber: 4, date: '2024-06-13', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Foreign: June 10 10:00 to June 13 16:00 = 78h
      // That's 3 full 24h + 6h remaining
      // 3 days at 100% = 3 * 49 = 147
      // Remaining 6h (<=8h) = 1/3 of 49 = 16.33
      expect(result.duration.foreignHours).toBe(78);
      expect(result.diet.foreignDays.length).toBe(4);
      expect(result.diet.foreignDays[0].baseAmount).toBe(49); // full day
      expect(result.diet.foreignDays[1].baseAmount).toBe(49); // full day
      expect(result.diet.foreignDays[2].baseAmount).toBe(49); // full day
      expect(result.diet.foreignDays[3].baseAmount).toBeCloseTo(16.33, 1); // partial
      expect(result.diet.foreignTotal).toBeCloseTo(163.33, 0);
    });

    it('should give 1/2 diet for multi-day remaining > 8h', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-12T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T08:00:00.000Z',
        borderCrossingIn: '2024-06-11T18:00:00.000Z', // 34h foreign = 1 full day + 10h
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
          { dayNumber: 2, date: '2024-06-11', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Foreign: 34h = 1 full day + 10h
      expect(result.duration.foreignHours).toBe(34);
      // Day 1: full day => 100% = 49
      expect(result.diet.foreignDays[0].baseAmount).toBe(49);
      // Day 2: 10h remaining (>8h) => 1/2 of 49 = 24.50
      expect(result.diet.foreignDays[1].baseAmount).toBeCloseTo(24.50, 1);
    });

    it('should handle multi-day foreign with meal deductions on different days', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-12T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T08:00:00.000Z',
        borderCrossingIn: '2024-06-12T16:00:00.000Z', // 56h foreign
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: true, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
          { dayNumber: 2, date: '2024-06-11', isForeign: true, breakfastProvided: true, lunchProvided: false, dinnerProvided: true, accommodationType: 'NONE', accommodationCost: null },
          { dayNumber: 3, date: '2024-06-12', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // 56h foreign = 2 full days + 8h
      // Day 1: 100% = 49, lunch deduction = 30% of 49 = 14.70 => final = 34.30
      expect(result.diet.foreignDays[0].baseAmount).toBe(49);
      expect(result.diet.foreignDays[0].deductions.lunch).toBeCloseTo(14.7, 1);
      expect(result.diet.foreignDays[0].finalAmount).toBeCloseTo(34.3, 1);

      // Day 2: 100% = 49, breakfast 15% = 7.35, dinner 30% = 14.70 => final = 26.95
      expect(result.diet.foreignDays[1].baseAmount).toBe(49);
      expect(result.diet.foreignDays[1].deductions.breakfast).toBeCloseTo(7.35, 1);
      expect(result.diet.foreignDays[1].deductions.dinner).toBeCloseTo(14.7, 1);
      expect(result.diet.foreignDays[1].finalAmount).toBeCloseTo(26.95, 1);

      // Day 3: 8h remaining (<=8h) => 1/3 of 49 = 16.33, no deductions => final = 16.33
      expect(result.diet.foreignDays[2].baseAmount).toBeCloseTo(16.33, 1);
      expect(result.diet.foreignDays[2].finalAmount).toBeCloseTo(16.33, 1);
    });
  });

  // =====================
  // Boundary conditions for foreign diet thresholds
  // =====================

  describe('Foreign diet threshold boundaries', () => {
    it('should give 1/3 diet for exactly 8h foreign (<=8h threshold)', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-10T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T08:00:00.000Z',
        borderCrossingIn: '2024-06-10T16:00:00.000Z', // exactly 8h foreign
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Exactly 8h => <=8h => 1/3 of 49 = 16.33
      expect(result.duration.foreignHours).toBe(8);
      expect(result.diet.foreignDays[0].baseAmount).toBeCloseTo(16.33, 1);
    });

    it('should give 1/2 diet for exactly 12h foreign (<=12h threshold)', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-10T22:00:00.000Z',
        borderCrossingOut: '2024-06-10T07:00:00.000Z',
        borderCrossingIn: '2024-06-10T19:00:00.000Z', // exactly 12h foreign
        foreignCountry: 'DE',
        transportType: 'COMPANY_VEHICLE',
        advanceAmount: 0,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: null,
        transportReceipts: [],
        additionalCosts: [],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Exactly 12h => 8-12h => 1/2 of 49 = 24.50
      expect(result.duration.foreignHours).toBe(12);
      expect(result.diet.foreignDays[0].baseAmount).toBeCloseTo(24.50, 1);
    });
  });

  // =====================
  // Full end-to-end scenario
  // =====================

  describe('Full end-to-end foreign delegation', () => {
    it('should correctly combine all cost categories for a complete trip', async () => {
      const input: ForeignDelegationInput = {
        departureAt: '2024-06-10T06:00:00.000Z',
        returnAt: '2024-06-12T20:00:00.000Z',
        borderCrossingOut: '2024-06-10T10:00:00.000Z',
        borderCrossingIn: '2024-06-12T16:00:00.000Z',
        foreignCountry: 'DE',
        transportType: 'PRIVATE_VEHICLE',
        advanceAmount: 200,
        days: [
          { dayNumber: 1, date: '2024-06-10', isForeign: false, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
          { dayNumber: 2, date: '2024-06-10', isForeign: true, breakfastProvided: false, lunchProvided: true, dinnerProvided: false, accommodationType: 'RECEIPT', accommodationCost: 130 },
          { dayNumber: 3, date: '2024-06-11', isForeign: true, breakfastProvided: true, lunchProvided: false, dinnerProvided: false, accommodationType: 'LUMP_SUM', accommodationCost: null },
          { dayNumber: 4, date: '2024-06-12', isForeign: false, breakfastProvided: false, lunchProvided: false, dinnerProvided: false, accommodationType: 'NONE', accommodationCost: null },
        ],
        mileageDetails: {
          vehicleType: 'CAR_ABOVE_900',
          vehiclePlate: 'WA 12345',
          segments: [{ date: '2024-06-10', startLocation: 'Warszawa', endLocation: 'Berlin', km: 800 }],
        },
        transportReceipts: [],
        additionalCosts: [
          { description: 'Parking', category: 'PARKING', amount: 20 },
        ],
      };

      const result = await calculateForeignDelegation(mockPrisma, input);

      // Duration
      expect(result.duration.totalHours).toBe(62);
      expect(result.duration.domesticHours).toBe(8); // 4h + 4h
      expect(result.duration.foreignHours).toBe(54); // 54h

      // Domestic diet: 8h => 50% of 45 = 22.50
      expect(result.diet.domesticDays.length).toBe(1);
      expect(result.diet.domesticDays[0].baseAmount).toBeCloseTo(22.50, 1);

      // Foreign diet: 54h = 2 full days + 6h
      expect(result.diet.foreignDays.length).toBe(2);

      // Accommodation: 130 (within 150 limit) + 37.50 (lump sum: 25% of 150)
      expect(result.accommodation.nights[0].amount).toBe(130);
      expect(result.accommodation.nights[1].amount).toBeCloseTo(37.50, 1);
      expect(result.accommodation.total).toBeCloseTo(167.50, 1);

      // Transport: 800 * 0.89 = 712
      expect(result.transport.mileage!.total).toBe(712);
      expect(result.transport.total).toBe(712);

      // Additional: 20
      expect(result.additionalCosts.total).toBe(20);

      // Grand total
      const expectedGrand = result.diet.total + result.accommodation.total + result.transport.total + result.additionalCosts.total;
      expect(result.summary.grandTotal).toBeCloseTo(expectedGrand, 1);

      // Amount due
      expect(result.summary.advanceAmount).toBe(200);
      expect(result.summary.amountDue).toBeCloseTo(result.summary.grandTotal - 200, 1);
    });
  });
});
