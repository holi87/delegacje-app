import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  calculateDelegation,
  type CalculationInput,
  type CalculationResult,
} from '../src/modules/delegations/calculation.service.js';

// =====================
// Mock Prisma Client
// =====================

const DEFAULT_DOMESTIC_RATE = {
  id: 'rate-1',
  dailyDiet: { toString: () => '45.00' },
  accommodationLumpSum: { toString: () => '67.50' },
  accommodationMaxReceipt: { toString: () => '900.00' },
  localTransportLumpSum: { toString: () => '9.00' },
  breakfastDeductionPct: 25,
  lunchDeductionPct: 50,
  dinnerDeductionPct: 25,
  validFrom: new Date('2022-01-01'),
  validTo: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const DEFAULT_MILEAGE_RATE_CAR_ABOVE_900 = {
  id: 'mileage-1',
  vehicleType: 'CAR_ABOVE_900',
  ratePerKm: { toString: () => '1.15' },
  validFrom: new Date('2022-01-01'),
  validTo: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMockPrisma(): PrismaClient {
  return {
    domesticRate: {
      findFirst: vi.fn().mockResolvedValue(DEFAULT_DOMESTIC_RATE),
    },
    mileageRate: {
      findFirst: vi.fn().mockResolvedValue(DEFAULT_MILEAGE_RATE_CAR_ABOVE_900),
    },
  } as unknown as PrismaClient;
}

// =====================
// Helper to build a minimal CalculationInput
// =====================

function buildInput(overrides: Partial<CalculationInput> = {}): CalculationInput {
  return {
    departureAt: '2026-03-10T07:00:00Z',
    returnAt: '2026-03-10T17:00:00Z',
    transportType: 'COMPANY_VEHICLE',
    vehicleType: null,
    advanceAmount: 0,
    days: [
      {
        dayNumber: 1,
        date: '2026-03-10',
        breakfastProvided: false,
        lunchProvided: false,
        dinnerProvided: false,
        accommodationType: 'NONE',
        accommodationCost: null,
      },
    ],
    mileageDetails: null,
    transportReceipts: [],
    additionalCosts: [],
    ...overrides,
  };
}

// =====================
// Tests
// =====================

describe('calculateDelegation', () => {
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  // ------------------------------------------------------------------
  // Test A: Single-day, 10h, no meals provided
  // ------------------------------------------------------------------
  describe('Test A: Single-day, 10h, no meals', () => {
    it('should return 50% diet (22.50 PLN) for 8-12h trip with no meals', async () => {
      const input = buildInput({
        departureAt: '2026-03-10T07:00:00Z',
        returnAt: '2026-03-10T17:00:00Z',
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.duration.totalHours).toBe(10);
      expect(result.duration.fullDays).toBe(0);
      expect(result.duration.remainingHours).toBe(10);

      expect(result.diet.rateUsed).toBe(45);
      expect(result.diet.days).toHaveLength(1);

      const day1 = result.diet.days[0];
      expect(day1.baseAmount).toBe(22.5);
      expect(day1.deductions.breakfast).toBe(0);
      expect(day1.deductions.lunch).toBe(0);
      expect(day1.deductions.dinner).toBe(0);
      expect(day1.deductions.total).toBe(0);
      expect(day1.finalAmount).toBe(22.5);

      expect(result.diet.total).toBe(22.5);
      expect(result.summary.dietTotal).toBe(22.5);
    });
  });

  // ------------------------------------------------------------------
  // Test B: Single-day, 10h, lunch provided
  // ------------------------------------------------------------------
  describe('Test B: Single-day, 10h, lunch provided', () => {
    it('should deduct lunch from FULL diet and clamp to 0', async () => {
      const input = buildInput({
        departureAt: '2026-03-10T07:00:00Z',
        returnAt: '2026-03-10T17:00:00Z',
        days: [
          {
            dayNumber: 1,
            date: '2026-03-10',
            breakfastProvided: false,
            lunchProvided: true,
            dinnerProvided: false,
            accommodationType: 'NONE',
            accommodationCost: null,
          },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      const day1 = result.diet.days[0];
      expect(day1.baseAmount).toBe(22.5); // 50% of 45
      expect(day1.deductions.lunch).toBe(22.5); // 50% of 45 (FULL diet)
      expect(day1.deductions.total).toBe(22.5);
      expect(day1.finalAmount).toBe(0); // max(0, 22.50 - 22.50)

      expect(result.diet.total).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // Test C: Multi-day, 4 days + 3h
  // ------------------------------------------------------------------
  describe('Test C: Multi-day, 4 days + 3h', () => {
    it('should calculate 191.25 PLN for 4 full days + 3h remainder with breakfast on day 3', async () => {
      const input = buildInput({
        departureAt: '2026-03-10T07:00:00Z',
        returnAt: '2026-03-14T10:00:00Z',
        days: [
          {
            dayNumber: 1,
            date: '2026-03-10',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'NONE',
            accommodationCost: null,
          },
          {
            dayNumber: 2,
            date: '2026-03-11',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'NONE',
            accommodationCost: null,
          },
          {
            dayNumber: 3,
            date: '2026-03-12',
            breakfastProvided: true,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'NONE',
            accommodationCost: null,
          },
          {
            dayNumber: 4,
            date: '2026-03-13',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'NONE',
            accommodationCost: null,
          },
          {
            dayNumber: 5,
            date: '2026-03-14',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'NONE',
            accommodationCost: null,
          },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      // Duration: 10.03 07:00 -> 14.03 10:00 = 99h total
      expect(result.duration.totalHours).toBe(99);
      expect(result.duration.fullDays).toBe(4);
      expect(result.duration.remainingHours).toBe(3);

      expect(result.diet.days).toHaveLength(5);

      // Day 1: 45 - 0 = 45
      expect(result.diet.days[0].baseAmount).toBe(45);
      expect(result.diet.days[0].finalAmount).toBe(45);

      // Day 2: 45 - 0 = 45
      expect(result.diet.days[1].baseAmount).toBe(45);
      expect(result.diet.days[1].finalAmount).toBe(45);

      // Day 3: 45 - 11.25 (breakfast) = 33.75
      expect(result.diet.days[2].baseAmount).toBe(45);
      expect(result.diet.days[2].deductions.breakfast).toBe(11.25);
      expect(result.diet.days[2].finalAmount).toBe(33.75);

      // Day 4: 45 - 0 = 45
      expect(result.diet.days[3].baseAmount).toBe(45);
      expect(result.diet.days[3].finalAmount).toBe(45);

      // Day 5: 3h remaining (<=8h -> 50%) = 22.50, no deductions
      expect(result.diet.days[4].hours).toBe(3);
      expect(result.diet.days[4].baseAmount).toBe(22.5);
      expect(result.diet.days[4].finalAmount).toBe(22.5);

      expect(result.diet.total).toBe(191.25);
    });
  });

  // ------------------------------------------------------------------
  // Test D: Short trip < 8h
  // ------------------------------------------------------------------
  describe('Test D: Short trip < 8h', () => {
    it('should return diet = 0 for a trip under 8 hours', async () => {
      const input = buildInput({
        departureAt: '2026-03-10T09:00:00Z',
        returnAt: '2026-03-10T14:00:00Z',
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.duration.totalHours).toBe(5);
      expect(result.diet.days).toHaveLength(1);
      expect(result.diet.days[0].baseAmount).toBe(0);
      expect(result.diet.days[0].finalAmount).toBe(0);
      expect(result.diet.total).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // Full meals in a day -> diet = 0, not negative
  // ------------------------------------------------------------------
  describe('Full meals provided in a day', () => {
    it('should clamp diet to 0 when all meals provided (deductions exceed base)', async () => {
      const input = buildInput({
        departureAt: '2026-03-10T06:00:00Z',
        returnAt: '2026-03-10T19:00:00Z', // 13h -> 100% diet = 45
        days: [
          {
            dayNumber: 1,
            date: '2026-03-10',
            breakfastProvided: true,
            lunchProvided: true,
            dinnerProvided: true,
            accommodationType: 'NONE',
            accommodationCost: null,
          },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      const day1 = result.diet.days[0];
      expect(day1.baseAmount).toBe(45); // 100% diet for >12h
      // Deductions: 25% + 50% + 25% = 100% of 45 = 45
      expect(day1.deductions.breakfast).toBe(11.25);
      expect(day1.deductions.lunch).toBe(22.5);
      expect(day1.deductions.dinner).toBe(11.25);
      expect(day1.deductions.total).toBe(45);
      expect(day1.finalAmount).toBe(0); // max(0, 45 - 45) = 0, NOT negative

      expect(result.diet.total).toBe(0);
    });

    it('should clamp diet to 0 for 50% day when all meals provided', async () => {
      // 10h trip -> 50% diet = 22.50, deductions = 100% of full 45 = 45
      const input = buildInput({
        departureAt: '2026-03-10T07:00:00Z',
        returnAt: '2026-03-10T17:00:00Z',
        days: [
          {
            dayNumber: 1,
            date: '2026-03-10',
            breakfastProvided: true,
            lunchProvided: true,
            dinnerProvided: true,
            accommodationType: 'NONE',
            accommodationCost: null,
          },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      const day1 = result.diet.days[0];
      expect(day1.baseAmount).toBe(22.5);
      expect(day1.deductions.total).toBe(45); // all 3 meals from FULL diet
      expect(day1.finalAmount).toBe(0); // max(0, 22.50 - 45) = 0
    });
  });

  // ------------------------------------------------------------------
  // Accommodation: RECEIPT within limit
  // ------------------------------------------------------------------
  describe('Accommodation RECEIPT within limit', () => {
    it('should use actual receipt cost when within 900 PLN limit', async () => {
      const input = buildInput({
        days: [
          {
            dayNumber: 1,
            date: '2026-03-10',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'RECEIPT',
            accommodationCost: 350,
          },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.accommodation.nights).toHaveLength(1);
      expect(result.accommodation.nights[0].type).toBe('RECEIPT');
      expect(result.accommodation.nights[0].amount).toBe(350);
      expect(result.accommodation.nights[0].overLimit).toBe(false);
      expect(result.accommodation.total).toBe(350);
    });
  });

  // ------------------------------------------------------------------
  // Accommodation: RECEIPT exceeding 900 limit -> capped and flagged
  // ------------------------------------------------------------------
  describe('Accommodation RECEIPT exceeding limit', () => {
    it('should cap at 900 PLN and flag overLimit when receipt exceeds limit', async () => {
      const input = buildInput({
        days: [
          {
            dayNumber: 1,
            date: '2026-03-10',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'RECEIPT',
            accommodationCost: 1200,
          },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.accommodation.nights).toHaveLength(1);
      expect(result.accommodation.nights[0].type).toBe('RECEIPT');
      expect(result.accommodation.nights[0].amount).toBe(900); // capped
      expect(result.accommodation.nights[0].overLimit).toBe(true);
      expect(result.accommodation.total).toBe(900);
    });
  });

  // ------------------------------------------------------------------
  // Accommodation: LUMP_SUM
  // ------------------------------------------------------------------
  describe('Accommodation LUMP_SUM', () => {
    it('should use lump sum rate (67.50 PLN)', async () => {
      const input = buildInput({
        days: [
          {
            dayNumber: 1,
            date: '2026-03-10',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'LUMP_SUM',
            accommodationCost: null,
          },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.accommodation.nights).toHaveLength(1);
      expect(result.accommodation.nights[0].type).toBe('LUMP_SUM');
      expect(result.accommodation.nights[0].amount).toBe(67.5);
      expect(result.accommodation.total).toBe(67.5);
    });
  });

  // ------------------------------------------------------------------
  // Accommodation: FREE
  // ------------------------------------------------------------------
  describe('Accommodation FREE', () => {
    it('should return 0 for free accommodation', async () => {
      const input = buildInput({
        days: [
          {
            dayNumber: 1,
            date: '2026-03-10',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'FREE',
            accommodationCost: null,
          },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.accommodation.nights).toHaveLength(1);
      expect(result.accommodation.nights[0].type).toBe('FREE');
      expect(result.accommodation.nights[0].amount).toBe(0);
      expect(result.accommodation.total).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // Mileage calculation: 620 km x 1.15 = 713.00
  // ------------------------------------------------------------------
  describe('Mileage calculation', () => {
    it('should calculate 620 km x 1.15 = 713.00 PLN', async () => {
      const input = buildInput({
        transportType: 'PRIVATE_VEHICLE',
        vehicleType: 'CAR_ABOVE_900',
        mileageDetails: {
          vehicleType: 'CAR_ABOVE_900',
          vehiclePlate: 'WA 12345',
          distanceKm: 620,
        },
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.transport.mileage).not.toBeNull();
      expect(result.transport.mileage!.distanceKm).toBe(620);
      expect(result.transport.mileage!.ratePerKm).toBe(1.15);
      expect(result.transport.mileage!.total).toBe(713);
      expect(result.transport.total).toBe(713);
    });

    it('should choose <= 900 car mileage rate when engine capacity is 900 cm3', async () => {
      const mileageRateFindFirst = vi
        .fn()
        .mockResolvedValue(DEFAULT_MILEAGE_RATE_CAR_ABOVE_900);
      prisma = {
        ...createMockPrisma(),
        mileageRate: { findFirst: mileageRateFindFirst },
      } as unknown as PrismaClient;

      const input = buildInput({
        transportType: 'PRIVATE_VEHICLE',
        vehicleType: 'CAR_ABOVE_900',
        mileageDetails: {
          vehicleType: 'CAR_ABOVE_900',
          engineCapacityCm3: 900,
          vehiclePlate: 'WA 12345',
          distanceKm: 50,
        },
      });

      await calculateDelegation(prisma, input);

      expect(mileageRateFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vehicleType: 'CAR_BELOW_900',
          }),
        })
      );
    });
  });

  // ------------------------------------------------------------------
  // Transport receipts sum
  // ------------------------------------------------------------------
  describe('Transport receipts', () => {
    it('should sum transport receipts for public transport', async () => {
      const input = buildInput({
        transportType: 'PUBLIC_TRANSPORT',
        transportReceipts: [
          { description: 'Bilet PKP', amount: 120.5, receiptNumber: 'R001' },
          { description: 'Bilet autobus', amount: 35.0, receiptNumber: 'R002' },
          { description: 'Taxi na dworzec', amount: 45.0, receiptNumber: null },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.transport.mileage).toBeNull();
      expect(result.transport.receipts).toHaveLength(3);
      expect(result.transport.total).toBe(200.5);
    });
  });

  // ------------------------------------------------------------------
  // Mixed transport: mileage + receipts
  // ------------------------------------------------------------------
  describe('Mixed transport', () => {
    it('should sum mileage and receipts for mixed transport type', async () => {
      const input = buildInput({
        transportType: 'MIXED',
        vehicleType: 'CAR_ABOVE_900',
        mileageDetails: {
          vehicleType: 'CAR_ABOVE_900',
          vehiclePlate: 'WA 12345',
          distanceKm: 100,
        },
        transportReceipts: [
          { description: 'Bilet PKP', amount: 50.0, receiptNumber: 'R001' },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      // Mileage: 100 * 1.15 = 115
      expect(result.transport.mileage!.total).toBe(115);
      // Receipts: 50
      // Total: 165
      expect(result.transport.total).toBe(165);
    });
  });

  // ------------------------------------------------------------------
  // Company vehicle: no transport cost
  // ------------------------------------------------------------------
  describe('Company vehicle', () => {
    it('should return 0 transport cost for company vehicle', async () => {
      const input = buildInput({
        transportType: 'COMPANY_VEHICLE',
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.transport.mileage).toBeNull();
      expect(result.transport.total).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // Additional costs sum
  // ------------------------------------------------------------------
  describe('Additional costs', () => {
    it('should sum all additional costs', async () => {
      const input = buildInput({
        additionalCosts: [
          {
            description: 'Parking',
            category: 'PARKING',
            amount: 50.0,
            receiptNumber: 'P001',
          },
          {
            description: 'Opłata za autostradę',
            category: 'TOLL',
            amount: 32.0,
            receiptNumber: 'T001',
          },
          {
            description: 'Materiały biurowe',
            category: 'OTHER',
            amount: 15.5,
            receiptNumber: null,
          },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.additionalCosts.items).toHaveLength(3);
      expect(result.additionalCosts.total).toBe(97.5);
    });
  });

  // ------------------------------------------------------------------
  // Grand total = diet + accommodation + transport + additional
  // ------------------------------------------------------------------
  describe('Grand total calculation', () => {
    it('should compute grandTotal as sum of all cost categories', async () => {
      const input = buildInput({
        departureAt: '2026-03-10T06:00:00Z',
        returnAt: '2026-03-10T19:00:00Z', // 13h -> 100% diet = 45
        transportType: 'PUBLIC_TRANSPORT',
        advanceAmount: 0,
        days: [
          {
            dayNumber: 1,
            date: '2026-03-10',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'LUMP_SUM',
            accommodationCost: null,
          },
        ],
        transportReceipts: [
          { description: 'Bilet', amount: 80.0, receiptNumber: 'R001' },
        ],
        additionalCosts: [
          {
            description: 'Parking',
            category: 'PARKING',
            amount: 25.0,
            receiptNumber: 'P001',
          },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      // Diet: 45.00 (13h, no meals)
      expect(result.summary.dietTotal).toBe(45);
      // Accommodation: 67.50 (lump sum)
      expect(result.summary.accommodationTotal).toBe(67.5);
      // Transport: 80.00
      expect(result.summary.transportTotal).toBe(80);
      // Additional: 25.00
      expect(result.summary.additionalTotal).toBe(25);
      // Grand total: 45 + 67.50 + 80 + 25 = 217.50
      expect(result.summary.grandTotal).toBe(217.5);
      expect(result.summary.amountDue).toBe(217.5);
    });
  });

  // ------------------------------------------------------------------
  // Amount due = grand total - advance (positive case)
  // ------------------------------------------------------------------
  describe('Amount due with advance payment', () => {
    it('should subtract advance from grand total', async () => {
      const input = buildInput({
        departureAt: '2026-03-10T07:00:00Z',
        returnAt: '2026-03-10T17:00:00Z',
        advanceAmount: 10,
      });

      const result = await calculateDelegation(prisma, input);

      // Diet: 22.50
      expect(result.summary.grandTotal).toBe(22.5);
      expect(result.summary.advanceAmount).toBe(10);
      expect(result.summary.amountDue).toBe(12.5);
    });
  });

  // ------------------------------------------------------------------
  // Amount due negative (advance > total -> delegate returns difference)
  // ------------------------------------------------------------------
  describe('Negative amount due (advance > total)', () => {
    it('should return negative amountDue when advance exceeds total', async () => {
      const input = buildInput({
        departureAt: '2026-03-10T07:00:00Z',
        returnAt: '2026-03-10T17:00:00Z',
        advanceAmount: 100,
      });

      const result = await calculateDelegation(prisma, input);

      // Diet: 22.50, advance: 100
      expect(result.summary.grandTotal).toBe(22.5);
      expect(result.summary.amountDue).toBe(-77.5);
    });
  });

  // ------------------------------------------------------------------
  // Single-day > 12h -> 100% diet
  // ------------------------------------------------------------------
  describe('Single-day trip > 12 hours', () => {
    it('should return 100% diet for single-day trip over 12 hours', async () => {
      const input = buildInput({
        departureAt: '2026-03-10T06:00:00Z',
        returnAt: '2026-03-10T20:00:00Z', // 14h
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.duration.totalHours).toBe(14);
      expect(result.diet.days[0].baseAmount).toBe(45);
      expect(result.diet.days[0].finalAmount).toBe(45);
      expect(result.diet.total).toBe(45);
    });
  });

  // ------------------------------------------------------------------
  // Single-day exactly 8h -> 50% diet
  // ------------------------------------------------------------------
  describe('Single-day trip exactly 8 hours', () => {
    it('should return 50% diet for exactly 8 hours', async () => {
      const input = buildInput({
        departureAt: '2026-03-10T08:00:00Z',
        returnAt: '2026-03-10T16:00:00Z',
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.duration.totalHours).toBe(8);
      expect(result.diet.days[0].baseAmount).toBe(22.5);
      expect(result.diet.days[0].finalAmount).toBe(22.5);
    });
  });

  // ------------------------------------------------------------------
  // Single-day exactly 12h -> 50% diet (boundary: <=12 is 50%)
  // ------------------------------------------------------------------
  describe('Single-day trip exactly 12 hours', () => {
    it('should return 50% diet for exactly 12 hours', async () => {
      const input = buildInput({
        departureAt: '2026-03-10T06:00:00Z',
        returnAt: '2026-03-10T18:00:00Z',
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.duration.totalHours).toBe(12);
      expect(result.diet.days[0].baseAmount).toBe(22.5); // <=12h is 50%
      expect(result.diet.days[0].finalAmount).toBe(22.5);
    });
  });

  // ------------------------------------------------------------------
  // Multi-day: remaining > 8h -> 100% for last day
  // ------------------------------------------------------------------
  describe('Multi-day with remaining > 8h', () => {
    it('should give 100% diet for last partial day when remaining > 8h', async () => {
      // 1 full day + 10h remaining
      const input = buildInput({
        departureAt: '2026-03-10T07:00:00Z',
        returnAt: '2026-03-11T17:00:00Z', // 34h total = 1 full day + 10h
        days: [
          {
            dayNumber: 1,
            date: '2026-03-10',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'NONE',
            accommodationCost: null,
          },
          {
            dayNumber: 2,
            date: '2026-03-11',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'NONE',
            accommodationCost: null,
          },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.duration.fullDays).toBe(1);
      expect(result.duration.remainingHours).toBe(10);

      // Day 1: full day -> 100% = 45
      expect(result.diet.days[0].baseAmount).toBe(45);
      // Day 2: 10h remaining (>8h) -> 100% = 45
      expect(result.diet.days[1].baseAmount).toBe(45);
      expect(result.diet.total).toBe(90);
    });
  });

  // ------------------------------------------------------------------
  // Multi-day: remaining <= 8h -> 50% for last day
  // ------------------------------------------------------------------
  describe('Multi-day with remaining <= 8h', () => {
    it('should give 50% diet for last partial day when remaining <= 8h', async () => {
      // 1 full day + 6h remaining
      const input = buildInput({
        departureAt: '2026-03-10T07:00:00Z',
        returnAt: '2026-03-11T13:00:00Z', // 30h total = 1 full day + 6h
        days: [
          {
            dayNumber: 1,
            date: '2026-03-10',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'NONE',
            accommodationCost: null,
          },
          {
            dayNumber: 2,
            date: '2026-03-11',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'NONE',
            accommodationCost: null,
          },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.duration.fullDays).toBe(1);
      expect(result.duration.remainingHours).toBe(6);

      // Day 1: full day -> 100% = 45
      expect(result.diet.days[0].baseAmount).toBe(45);
      // Day 2: 6h remaining (<=8h) -> 50% = 22.50
      expect(result.diet.days[1].baseAmount).toBe(22.5);
      expect(result.diet.total).toBe(67.5);
    });
  });

  // ------------------------------------------------------------------
  // Multiple accommodation nights with mixed types
  // ------------------------------------------------------------------
  describe('Multiple accommodation nights', () => {
    it('should handle mixed accommodation types across days', async () => {
      const input = buildInput({
        departureAt: '2026-03-10T07:00:00Z',
        returnAt: '2026-03-13T10:00:00Z', // 3 days + 3h
        days: [
          {
            dayNumber: 1,
            date: '2026-03-10',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'RECEIPT',
            accommodationCost: 250,
          },
          {
            dayNumber: 2,
            date: '2026-03-11',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'LUMP_SUM',
            accommodationCost: null,
          },
          {
            dayNumber: 3,
            date: '2026-03-12',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'FREE',
            accommodationCost: null,
          },
          {
            dayNumber: 4,
            date: '2026-03-13',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'NONE',
            accommodationCost: null,
          },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      // Night 1: RECEIPT 250
      expect(result.accommodation.nights[0].type).toBe('RECEIPT');
      expect(result.accommodation.nights[0].amount).toBe(250);
      // Night 2: LUMP_SUM 67.50
      expect(result.accommodation.nights[1].type).toBe('LUMP_SUM');
      expect(result.accommodation.nights[1].amount).toBe(67.5);
      // Night 3: FREE 0
      expect(result.accommodation.nights[2].type).toBe('FREE');
      expect(result.accommodation.nights[2].amount).toBe(0);
      // Night 4: NONE — not added to nights array
      expect(result.accommodation.nights).toHaveLength(3);

      // Total: 250 + 67.50 + 0 = 317.50
      expect(result.accommodation.total).toBe(317.5);
    });
  });

  // ------------------------------------------------------------------
  // Receipt at exactly 900 limit
  // ------------------------------------------------------------------
  describe('Accommodation RECEIPT at exactly the limit', () => {
    it('should accept receipt at exactly 900 PLN without overLimit flag', async () => {
      const input = buildInput({
        days: [
          {
            dayNumber: 1,
            date: '2026-03-10',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'RECEIPT',
            accommodationCost: 900,
          },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.accommodation.nights[0].amount).toBe(900);
      expect(result.accommodation.nights[0].overLimit).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // Comprehensive end-to-end scenario
  // ------------------------------------------------------------------
  describe('Full end-to-end delegation calculation', () => {
    it('should correctly combine diet, accommodation, transport, and additional costs', async () => {
      const input = buildInput({
        departureAt: '2026-03-10T06:00:00Z',
        returnAt: '2026-03-12T18:00:00Z', // 60h = 2 full days + 12h
        transportType: 'PRIVATE_VEHICLE',
        vehicleType: 'CAR_ABOVE_900',
        advanceAmount: 200,
        days: [
          {
            dayNumber: 1,
            date: '2026-03-10',
            breakfastProvided: false,
            lunchProvided: true,
            dinnerProvided: false,
            accommodationType: 'RECEIPT',
            accommodationCost: 300,
          },
          {
            dayNumber: 2,
            date: '2026-03-11',
            breakfastProvided: true,
            lunchProvided: false,
            dinnerProvided: true,
            accommodationType: 'LUMP_SUM',
            accommodationCost: null,
          },
          {
            dayNumber: 3,
            date: '2026-03-12',
            breakfastProvided: false,
            lunchProvided: false,
            dinnerProvided: false,
            accommodationType: 'NONE',
            accommodationCost: null,
          },
        ],
        mileageDetails: {
          vehicleType: 'CAR_ABOVE_900',
          vehiclePlate: 'KR 98765',
          distanceKm: 400,
        },
        additionalCosts: [
          {
            description: 'Parking',
            category: 'PARKING',
            amount: 40,
            receiptNumber: 'P001',
          },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      // Duration: 60h = 2 full days + 12h
      expect(result.duration.totalHours).toBe(60);
      expect(result.duration.fullDays).toBe(2);
      expect(result.duration.remainingHours).toBe(12);

      // Diet:
      // Day 1: 45 - 22.50 (lunch) = 22.50
      expect(result.diet.days[0].finalAmount).toBe(22.5);
      // Day 2: 45 - 11.25 (breakfast) - 11.25 (dinner) = 22.50
      expect(result.diet.days[1].deductions.breakfast).toBe(11.25);
      expect(result.diet.days[1].deductions.dinner).toBe(11.25);
      expect(result.diet.days[1].finalAmount).toBe(22.5);
      // Day 3: 12h remaining (<=8h? No, multi-day remaining <=8h -> 50%).
      // Wait: 12h remaining. For multi-day: <=8h -> 50%, >8h -> 100%.
      // 12h > 8h -> 100% = 45
      expect(result.diet.days[2].baseAmount).toBe(45);
      expect(result.diet.days[2].finalAmount).toBe(45);

      const dietTotal = 22.5 + 22.5 + 45; // = 90
      expect(result.diet.total).toBe(dietTotal);

      // Accommodation: 300 (receipt) + 67.50 (lump sum) = 367.50
      expect(result.accommodation.total).toBe(367.5);

      // Transport (mileage): 400 * 1.15 = 460
      expect(result.transport.total).toBe(460);

      // Additional: 40
      expect(result.additionalCosts.total).toBe(40);

      // Grand total: 90 + 367.50 + 460 + 40 = 957.50
      const expectedGrand = 90 + 367.5 + 460 + 40;
      expect(result.summary.grandTotal).toBe(expectedGrand);

      // Amount due: 957.50 - 200 = 757.50
      expect(result.summary.amountDue).toBe(expectedGrand - 200);
    });
  });

  // ------------------------------------------------------------------
  // Rate lookup: missing domestic rate throws error
  // ------------------------------------------------------------------
  describe('Missing domestic rate', () => {
    it('should throw when no applicable domestic rate is found', async () => {
      const mockPrisma = {
        domesticRate: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        mileageRate: {
          findFirst: vi.fn().mockResolvedValue(DEFAULT_MILEAGE_RATE_CAR_ABOVE_900),
        },
      } as unknown as PrismaClient;

      const input = buildInput();

      await expect(calculateDelegation(mockPrisma, input)).rejects.toThrow(
        'Nie znaleziono obowiązujących stawek diety krajowej'
      );
    });
  });

  // ------------------------------------------------------------------
  // Rate lookup: missing mileage rate throws error
  // ------------------------------------------------------------------
  describe('Missing mileage rate', () => {
    it('should throw when no applicable mileage rate is found for private vehicle', async () => {
      const mockPrisma = {
        domesticRate: {
          findFirst: vi.fn().mockResolvedValue(DEFAULT_DOMESTIC_RATE),
        },
        mileageRate: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as unknown as PrismaClient;

      const input = buildInput({
        transportType: 'PRIVATE_VEHICLE',
        vehicleType: 'CAR_ABOVE_900',
        mileageDetails: {
          vehicleType: 'CAR_ABOVE_900',
          vehiclePlate: 'WA 12345',
          distanceKm: 100,
        },
      });

      await expect(calculateDelegation(mockPrisma, input)).rejects.toThrow(
        'Nie znaleziono obowiązujących stawek kilometrówki'
      );
    });
  });

  // ------------------------------------------------------------------
  // Zero-distance mileage
  // ------------------------------------------------------------------
  describe('Zero distance mileage', () => {
    it('should return 0 mileage total for 0 km', async () => {
      const input = buildInput({
        transportType: 'PRIVATE_VEHICLE',
        vehicleType: 'CAR_ABOVE_900',
        mileageDetails: {
          vehicleType: 'CAR_ABOVE_900',
          vehiclePlate: 'WA 12345',
          distanceKm: 0,
        },
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.transport.mileage!.total).toBe(0);
      expect(result.transport.total).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // No additional costs
  // ------------------------------------------------------------------
  describe('Empty additional costs', () => {
    it('should return 0 when no additional costs provided', async () => {
      const input = buildInput({
        additionalCosts: [],
      });

      const result = await calculateDelegation(prisma, input);

      expect(result.additionalCosts.items).toHaveLength(0);
      expect(result.additionalCosts.total).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // Deduction percentages applied correctly (breakfast + dinner, no lunch)
  // ------------------------------------------------------------------
  describe('Partial meal deductions', () => {
    it('should deduct only breakfast and dinner (25% + 25% = 50% of full diet)', async () => {
      const input = buildInput({
        departureAt: '2026-03-10T06:00:00Z',
        returnAt: '2026-03-10T20:00:00Z', // 14h -> 100% = 45
        days: [
          {
            dayNumber: 1,
            date: '2026-03-10',
            breakfastProvided: true,
            lunchProvided: false,
            dinnerProvided: true,
            accommodationType: 'NONE',
            accommodationCost: null,
          },
        ],
      });

      const result = await calculateDelegation(prisma, input);

      const day1 = result.diet.days[0];
      expect(day1.deductions.breakfast).toBe(11.25); // 25% of 45
      expect(day1.deductions.lunch).toBe(0);
      expect(day1.deductions.dinner).toBe(11.25); // 25% of 45
      expect(day1.deductions.total).toBe(22.5);
      expect(day1.finalAmount).toBe(22.5); // 45 - 22.50
    });
  });
});
