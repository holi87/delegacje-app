import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedDefaultRates() {
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
    console.log('Seeded domestic rates');
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
    console.log('Seeded mileage rates');
  }
}

async function main() {
  await seedDefaultRates();
  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
