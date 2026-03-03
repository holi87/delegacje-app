import { z } from 'zod';

// =====================
// Enum values (matching Prisma enums)
// =====================

const delegationTypeEnum = z.enum(['DOMESTIC', 'FOREIGN']);
const transportTypeEnum = z.enum(['COMPANY_VEHICLE', 'PUBLIC_TRANSPORT', 'PRIVATE_VEHICLE', 'MIXED']);
const vehicleTypeEnum = z.enum(['CAR_ABOVE_900', 'CAR_BELOW_900', 'MOTORCYCLE', 'MOPED']);
const accommodationTypeEnum = z.enum(['RECEIPT', 'LUMP_SUM', 'FREE', 'NONE']);

// =====================
// Sub-schemas
// =====================

const delegationDaySchema = z.object({
  dayNumber: z.number().int().min(1, 'Numer dnia musi być >= 1'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data musi być w formacie YYYY-MM-DD'),
  breakfastProvided: z.boolean().default(false),
  lunchProvided: z.boolean().default(false),
  dinnerProvided: z.boolean().default(false),
  accommodationType: accommodationTypeEnum.default('NONE'),
  accommodationCost: z
    .union([z.number().min(0, 'Kwota noclegu nie może być ujemna'), z.null()])
    .optional()
    .default(null),
});

const mileageDetailsSchema = z.object({
  vehicleType: vehicleTypeEnum,
  vehiclePlate: z.string().min(1, 'Numer rejestracyjny jest wymagany'),
  distanceKm: z.number().positive('Liczba kilometrów musi być większa od 0'),
});

const transportReceiptSchema = z.object({
  description: z.string().min(1, 'Opis biletu jest wymagany'),
  amount: z.number().min(0, 'Kwota biletu nie może być ujemna'),
  receiptNumber: z.string().nullable().optional(),
});

const additionalCostSchema = z.object({
  description: z.string().min(1, 'Opis kosztu jest wymagany'),
  category: z.string().min(1, 'Kategoria kosztu jest wymagana'),
  amount: z.number().min(0, 'Kwota kosztu nie może być ujemna'),
  receiptNumber: z.string().nullable().optional(),
});

// =====================
// Create delegation schema
// =====================

export const createDelegationSchema = z
  .object({
    type: delegationTypeEnum.default('DOMESTIC'),
    purpose: z.string().min(1, 'Cel delegacji jest wymagany'),
    destination: z.string().min(1, 'Miejsce delegacji jest wymagane'),
    departureAt: z.string().datetime({ message: 'Nieprawidłowy format daty wyjazdu (ISO 8601)' }),
    returnAt: z.string().datetime({ message: 'Nieprawidłowy format daty powrotu (ISO 8601)' }),
    transportType: transportTypeEnum,
    vehicleType: vehicleTypeEnum.nullable().optional(),
    transportNotes: z.string().nullable().optional(),
    accommodationType: accommodationTypeEnum.default('NONE'),
    advanceAmount: z.number().min(0, 'Kwota zaliczki nie może być ujemna').default(0),
    days: z.array(delegationDaySchema).min(1, 'Wymagany co najmniej jeden dzień delegacji'),
    mileageDetails: mileageDetailsSchema.nullable().optional(),
    transportReceipts: z.array(transportReceiptSchema).optional().default([]),
    additionalCosts: z.array(additionalCostSchema).optional().default([]),
  })
  .refine(
    (data) => new Date(data.returnAt) > new Date(data.departureAt),
    {
      message: 'Data powrotu musi być późniejsza niż data wyjazdu',
      path: ['returnAt'],
    }
  )
  .refine(
    (data) => {
      if (
        data.transportType === 'PRIVATE_VEHICLE' ||
        data.transportType === 'MIXED'
      ) {
        return data.mileageDetails != null;
      }
      return true;
    },
    {
      message: 'Dane kilometrówki są wymagane dla pojazdu prywatnego / transportu mieszanego',
      path: ['mileageDetails'],
    }
  );

export type CreateDelegationInput = z.infer<typeof createDelegationSchema>;

// =====================
// Update delegation schema (partial, all optional)
// =====================

export const updateDelegationSchema = z
  .object({
    purpose: z.string().min(1, 'Cel delegacji jest wymagany').optional(),
    destination: z.string().min(1, 'Miejsce delegacji jest wymagane').optional(),
    departureAt: z.string().datetime({ message: 'Nieprawidłowy format daty wyjazdu (ISO 8601)' }).optional(),
    returnAt: z.string().datetime({ message: 'Nieprawidłowy format daty powrotu (ISO 8601)' }).optional(),
    transportType: transportTypeEnum.optional(),
    vehicleType: vehicleTypeEnum.nullable().optional(),
    transportNotes: z.string().nullable().optional(),
    accommodationType: accommodationTypeEnum.optional(),
    advanceAmount: z.number().min(0, 'Kwota zaliczki nie może być ujemna').optional(),
    days: z.array(delegationDaySchema).min(1, 'Wymagany co najmniej jeden dzień delegacji').optional(),
    mileageDetails: mileageDetailsSchema.nullable().optional(),
    transportReceipts: z.array(transportReceiptSchema).optional(),
    additionalCosts: z.array(additionalCostSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.departureAt && data.returnAt) {
        return new Date(data.returnAt) > new Date(data.departureAt);
      }
      return true;
    },
    {
      message: 'Data powrotu musi być późniejsza niż data wyjazdu',
      path: ['returnAt'],
    }
  );

export type UpdateDelegationInput = z.infer<typeof updateDelegationSchema>;

// =====================
// Query params schema
// =====================

export const listDelegationsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'SETTLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListDelegationsQuery = z.infer<typeof listDelegationsQuerySchema>;
