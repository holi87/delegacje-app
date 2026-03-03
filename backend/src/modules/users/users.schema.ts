import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Nieprawidłowy adres email'),
  password: z.string().min(8, 'Hasło musi mieć minimum 8 znaków'),
  role: z.enum(['ADMIN', 'DELEGATED']).default('DELEGATED'),
  profile: z.object({
    firstName: z.string().min(1, 'Imię jest wymagane'),
    lastName: z.string().min(1, 'Nazwisko jest wymagane'),
    position: z.string().min(1, 'Stanowisko jest wymagane'),
    defaultVehicle: z.enum(['CAR_ABOVE_900', 'CAR_BELOW_900', 'MOTORCYCLE', 'MOPED']).nullable().optional(),
    vehiclePlate: z.string().nullable().optional(),
    vehicleCapacity: z.string().nullable().optional(),
  }),
});

export const updateUserSchema = z.object({
  email: z.string().email('Nieprawidłowy adres email').optional(),
  role: z.enum(['ADMIN', 'DELEGATED']).optional(),
  isActive: z.boolean().optional(),
  profile: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    position: z.string().min(1).optional(),
    defaultVehicle: z.enum(['CAR_ABOVE_900', 'CAR_BELOW_900', 'MOTORCYCLE', 'MOPED']).nullable().optional(),
    vehiclePlate: z.string().nullable().optional(),
    vehicleCapacity: z.string().nullable().optional(),
  }).optional(),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  position: z.string().min(1).optional(),
  defaultVehicle: z.enum(['CAR_ABOVE_900', 'CAR_BELOW_900', 'MOTORCYCLE', 'MOPED']).nullable().optional(),
  vehiclePlate: z.string().nullable().optional(),
  vehicleCapacity: z.string().nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Obecne hasło jest wymagane'),
  newPassword: z.string().min(8, 'Nowe hasło musi mieć minimum 8 znaków'),
});
