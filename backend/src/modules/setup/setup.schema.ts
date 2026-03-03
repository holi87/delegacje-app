import { z } from 'zod';

export const setupInitSchema = z.object({
  company: z.object({
    name: z.string().min(1, 'Nazwa firmy jest wymagana'),
    nip: z.string().min(10, 'NIP musi mieć 10 cyfr').max(10),
    address: z.string().min(1, 'Adres jest wymagany'),
    postalCode: z.string().min(1, 'Kod pocztowy jest wymagany'),
    city: z.string().min(1, 'Miasto jest wymagane'),
  }),
  admin: z.object({
    email: z.string().email('Nieprawidłowy adres email'),
    password: z.string().min(8, 'Hasło musi mieć minimum 8 znaków'),
    firstName: z.string().min(1, 'Imię jest wymagane'),
    lastName: z.string().min(1, 'Nazwisko jest wymagane'),
    position: z.string().default('Administrator'),
  }),
  rates: z.object({
    useDefaults: z.boolean().default(true),
    domestic: z.object({
      dailyDiet: z.number().positive().optional(),
      breakfastDeductionPct: z.number().min(0).max(100).optional(),
      lunchDeductionPct: z.number().min(0).max(100).optional(),
      dinnerDeductionPct: z.number().min(0).max(100).optional(),
      validFrom: z.string().optional(),
    }).optional(),
    mileage: z.array(z.object({
      vehicleType: z.enum(['CAR_ABOVE_900', 'CAR_BELOW_900', 'MOTORCYCLE', 'MOPED']),
      ratePerKm: z.number().positive(),
    })).optional(),
  }).default({ useDefaults: true }),
});

export type SetupInitInput = z.infer<typeof setupInitSchema>;
