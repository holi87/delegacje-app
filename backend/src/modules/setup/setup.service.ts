import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { SetupInitInput } from './setup.schema.js';

export async function checkNeedsSetup(prisma: PrismaClient): Promise<boolean> {
  const userCount = await prisma.user.count();
  return userCount === 0;
}

export async function initializeSetup(prisma: PrismaClient, input: SetupInitInput) {
  const needsSetup = await checkNeedsSetup(prisma);
  if (!needsSetup) {
    throw new Error('SETUP_ALREADY_DONE');
  }

  const { company, admin, rates } = input;

  // Create company
  await prisma.companyInfo.create({
    data: {
      name: company.name,
      nip: company.nip,
      address: company.address,
      city: company.city,
      postalCode: company.postalCode,
    },
  });

  // Create admin user
  const passwordHash = await bcrypt.hash(admin.password, 12);
  const user = await prisma.user.create({
    data: {
      email: admin.email,
      passwordHash,
      role: 'ADMIN',
      profile: {
        create: {
          firstName: admin.firstName,
          lastName: admin.lastName,
          position: admin.position,
        },
      },
    },
  });

  // Seed rates if useDefaults or empty
  if (rates.useDefaults) {
    const rateCount = await prisma.domesticRate.count();
    if (rateCount === 0) {
      await prisma.domesticRate.create({
        data: {
          dailyDiet: 45.0,
          accommodationLumpSum: 67.5,
          accommodationMaxReceipt: 900.0,
          localTransportLumpSum: 9.0,
          breakfastDeductionPct: 25,
          lunchDeductionPct: 50,
          dinnerDeductionPct: 25,
          validFrom: new Date('2023-01-01'),
          validTo: null,
        },
      });
    }

    const mileageCount = await prisma.mileageRate.count();
    if (mileageCount === 0) {
      const mileageRates = [
        { vehicleType: 'CAR_ABOVE_900' as const, ratePerKm: 1.15 },
        { vehicleType: 'CAR_BELOW_900' as const, ratePerKm: 0.89 },
        { vehicleType: 'MOTORCYCLE' as const, ratePerKm: 0.69 },
        { vehicleType: 'MOPED' as const, ratePerKm: 0.42 },
      ];
      for (const rate of mileageRates) {
        await prisma.mileageRate.create({
          data: {
            vehicleType: rate.vehicleType,
            ratePerKm: rate.ratePerKm,
            validFrom: new Date('2023-01-17'),
            validTo: null,
          },
        });
      }
    }
  }

  return { id: user.id, email: user.email };
}
