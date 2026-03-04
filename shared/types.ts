// Shared types between frontend and backend

export type Role = 'ADMIN' | 'DELEGATED';

export type DelegationStatus = 'DRAFT' | 'SUBMITTED' | 'SETTLED';

export type DelegationType = 'DOMESTIC' | 'FOREIGN';

export type TransportType = 'COMPANY_VEHICLE' | 'PUBLIC_TRANSPORT' | 'PRIVATE_VEHICLE' | 'MIXED';

export type VehicleType = 'CAR_ABOVE_900' | 'CAR_BELOW_900' | 'MOTORCYCLE' | 'MOPED';

export type AccommodationType = 'RECEIPT' | 'LUMP_SUM' | 'FREE' | 'NONE';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  defaultVehicle?: VehicleType | null;
  vehiclePlate?: string | null;
  vehicleCapacity?: string | null;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  profile?: UserProfile | null;
}

export interface CompanyInfo {
  id: string;
  name: string;
  nip: string;
  address: string;
  city: string;
  postalCode: string;
}

export interface DelegationNumberingSettings {
  nextNumber: number;
  previewNumber: string;
}

export interface DomesticRate {
  id: string;
  dailyDiet: string;
  accommodationLumpSum: string;
  accommodationMaxReceipt: string;
  localTransportLumpSum: string;
  breakfastDeductionPct: number;
  lunchDeductionPct: number;
  dinnerDeductionPct: number;
  validFrom: string;
  validTo: string | null;
}

export interface MileageRate {
  id: string;
  vehicleType: VehicleType;
  ratePerKm: string;
  validFrom: string;
  validTo: string | null;
}

export interface ForeignDietRate {
  id: string;
  countryCode: string;
  countryName: string;
  currency: string;
  dailyDiet: string;
  accommodationLimit: string;
  breakfastDeductionPct: number;
  lunchDeductionPct: number;
  dinnerDeductionPct: number;
  validFrom: string;
  validTo: string | null;
}

export interface DelegationDayInput {
  dayNumber: number;
  date: string;
  breakfastProvided: boolean;
  lunchProvided: boolean;
  dinnerProvided: boolean;
  accommodationType: AccommodationType;
  accommodationCost?: string | null;
  accommodationReceiptNumber?: string | null;
  accommodationCurrency?: string | null;
  isForeign?: boolean;
}

export interface MileageDetailsInput {
  vehicleType: VehicleType;
  engineCapacityCm3?: number | null;
  vehiclePlate: string;
  distanceKm: number;
}

export interface TransportReceiptInput {
  description: string;
  amount: string;
  receiptNumber?: string | null;
}

export interface AdditionalCostInput {
  description: string;
  category: string;
  amount: string;
  receiptNumber?: string | null;
}

export interface DelegationInput {
  type: DelegationType;
  proposedNumber?: string | null;
  purpose: string;
  destination: string;
  departureAt: string;
  returnAt: string;
  transportType: TransportType;
  vehicleType?: VehicleType | null;
  transportNotes?: string | null;
  accommodationType: AccommodationType;
  advanceAmount: string;
  days: DelegationDayInput[];
  mileageDetails?: MileageDetailsInput | null;
  transportReceipts: TransportReceiptInput[];
  additionalCosts: AdditionalCostInput[];
  foreignCountry?: string | null;
  borderCrossingOut?: string | null;
  borderCrossingIn?: string | null;
  exchangeRate?: string | null;
  exchangeRateDate?: string | null;  // YYYY-MM-DD
  exchangeRateTable?: string | null;
}

export interface CalculationDayResult {
  dayNumber: number;
  hours: number;
  baseAmount: string;
  deductions: {
    breakfast: string;
    lunch: string;
    dinner: string;
    total: string;
  };
  finalAmount: string;
}

export interface CalculationResult {
  duration: {
    totalHours: number;
    fullDays: number;
    remainingHours: number;
  };
  diet: {
    rateUsed: string;
    days: CalculationDayResult[];
    total: string;
  };
  accommodation: {
    nights: Array<{
      type: AccommodationType;
      amount: string;
      originalAmount?: string | number;
      currency?: string | null;
      overLimit?: boolean;
      receiptNumber?: string | null;
    }>;
    total: string;
  };
  transport: {
    type: TransportType;
    mileage?: {
      distanceKm: number;
      ratePerKm: string;
      total: string;
    };
    receipts: TransportReceiptInput[];
    localTransportLumpSum: string;
    total: string;
  };
  additionalCosts: {
    items: Array<{ description: string; amount: string; receiptNumber?: string | null }>;
    total: string;
  };
  summary: {
    dietTotal: string;
    accommodationTotal: string;
    transportTotal: string;
    additionalTotal: string;
    grandTotal: string;
    advanceAmount: string;
    amountDue: string;
  };
}

export interface ForeignCalculationResult {
  duration: {
    totalHours: number;
    domesticHours: number;
    foreignHours: number;
  };
  diet: {
    domesticDays: CalculationDayResult[];
    foreignDays: CalculationDayResult[];
    domesticTotal: string;
    foreignTotal: string;
    total: string;
    foreignCurrency: string;
  };
  accommodation: {
    nights: Array<{
      type: AccommodationType;
      amount: string;
      originalAmount?: string | number;
      isForeign?: boolean;
      currency?: string | null;
      overLimit?: boolean;
      receiptNumber?: string | null;
    }>;
    total: string;
  };
  transport: {
    type: TransportType;
    mileage?: {
      distanceKm: number;
      ratePerKm: string;
      total: string;
    };
    receipts: TransportReceiptInput[];
    localTransportLumpSum: string;
    total: string;
  };
  additionalCosts: {
    items: Array<{ description: string; amount: string; receiptNumber?: string | null }>;
    total: string;
  };
  summary: {
    domesticDietTotal: string;
    foreignDietTotal: string;
    foreignDietTotalPln?: string;
    dietTotal: string;
    domesticAccommodationTotal?: string;
    foreignAccommodationTotal?: string;
    foreignAccommodationTotalPln?: string;
    accommodationTotal: string;
    transportTotal: string;
    additionalTotal: string;
    grandTotal: string;
    advanceAmount: string;
    amountDue: string;
    exchangeRate?: string;
    exchangeRateDate?: string;
    exchangeRateTable?: string;
    foreignCurrency?: string;
  };
}
