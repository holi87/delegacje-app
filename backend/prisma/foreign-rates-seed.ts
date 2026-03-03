import { PrismaClient } from '@prisma/client';

interface ForeignRateData {
  countryCode: string;
  countryName: string;
  currency: string;
  dailyDiet: number;
  accommodationLimit: number;
}

const FOREIGN_RATES: ForeignRateData[] = [
  // Western Europe
  { countryCode: 'DE', countryName: 'Niemcy', currency: 'EUR', dailyDiet: 49, accommodationLimit: 150 },
  { countryCode: 'FR', countryName: 'Francja', currency: 'EUR', dailyDiet: 50, accommodationLimit: 180 },
  { countryCode: 'GB', countryName: 'Wielka Brytania', currency: 'GBP', dailyDiet: 35, accommodationLimit: 200 },
  { countryCode: 'IT', countryName: 'Włochy', currency: 'EUR', dailyDiet: 48, accommodationLimit: 174 },
  { countryCode: 'ES', countryName: 'Hiszpania', currency: 'EUR', dailyDiet: 50, accommodationLimit: 160 },
  { countryCode: 'NL', countryName: 'Holandia', currency: 'EUR', dailyDiet: 50, accommodationLimit: 130 },
  { countryCode: 'BE', countryName: 'Belgia', currency: 'EUR', dailyDiet: 48, accommodationLimit: 161 },
  { countryCode: 'AT', countryName: 'Austria', currency: 'EUR', dailyDiet: 52, accommodationLimit: 130 },
  { countryCode: 'CH', countryName: 'Szwajcaria', currency: 'CHF', dailyDiet: 88, accommodationLimit: 200 },
  { countryCode: 'PT', countryName: 'Portugalia', currency: 'EUR', dailyDiet: 49, accommodationLimit: 120 },
  { countryCode: 'IE', countryName: 'Irlandia', currency: 'EUR', dailyDiet: 52, accommodationLimit: 160 },

  // Scandinavia
  { countryCode: 'NO', countryName: 'Norwegia', currency: 'NOK', dailyDiet: 476, accommodationLimit: 1800 },
  { countryCode: 'SE', countryName: 'Szwecja', currency: 'SEK', dailyDiet: 459, accommodationLimit: 1800 },
  { countryCode: 'DK', countryName: 'Dania', currency: 'DKK', dailyDiet: 406, accommodationLimit: 1400 },
  { countryCode: 'FI', countryName: 'Finlandia', currency: 'EUR', dailyDiet: 48, accommodationLimit: 160 },

  // Central Europe
  { countryCode: 'CZ', countryName: 'Czechy', currency: 'CZK', dailyDiet: 600, accommodationLimit: 3300 },
  { countryCode: 'SK', countryName: 'Słowacja', currency: 'EUR', dailyDiet: 43, accommodationLimit: 120 },
  { countryCode: 'HU', countryName: 'Węgry', currency: 'EUR', dailyDiet: 44, accommodationLimit: 130 },
  { countryCode: 'SI', countryName: 'Słowenia', currency: 'EUR', dailyDiet: 43, accommodationLimit: 130 },
  { countryCode: 'HR', countryName: 'Chorwacja', currency: 'EUR', dailyDiet: 42, accommodationLimit: 130 },

  // Eastern Europe
  { countryCode: 'UA', countryName: 'Ukraina', currency: 'EUR', dailyDiet: 41, accommodationLimit: 180 },
  { countryCode: 'RU', countryName: 'Rosja', currency: 'EUR', dailyDiet: 48, accommodationLimit: 200 },
  { countryCode: 'RO', countryName: 'Rumunia', currency: 'EUR', dailyDiet: 38, accommodationLimit: 120 },
  { countryCode: 'BG', countryName: 'Bułgaria', currency: 'EUR', dailyDiet: 35, accommodationLimit: 110 },
  { countryCode: 'RS', countryName: 'Serbia', currency: 'EUR', dailyDiet: 40, accommodationLimit: 100 },

  // Baltic States
  { countryCode: 'LT', countryName: 'Litwa', currency: 'EUR', dailyDiet: 39, accommodationLimit: 130 },
  { countryCode: 'LV', countryName: 'Łotwa', currency: 'EUR', dailyDiet: 42, accommodationLimit: 132 },
  { countryCode: 'EE', countryName: 'Estonia', currency: 'EUR', dailyDiet: 43, accommodationLimit: 130 },

  // South-Eastern Europe
  { countryCode: 'GR', countryName: 'Grecja', currency: 'EUR', dailyDiet: 48, accommodationLimit: 140 },
  { countryCode: 'TR', countryName: 'Turcja', currency: 'USD', dailyDiet: 53, accommodationLimit: 175 },

  // North America
  { countryCode: 'US', countryName: 'USA', currency: 'USD', dailyDiet: 59, accommodationLimit: 350 },
  { countryCode: 'CA', countryName: 'Kanada', currency: 'CAD', dailyDiet: 71, accommodationLimit: 250 },
  { countryCode: 'MX', countryName: 'Meksyk', currency: 'USD', dailyDiet: 50, accommodationLimit: 180 },

  // South America
  { countryCode: 'BR', countryName: 'Brazylia', currency: 'USD', dailyDiet: 45, accommodationLimit: 170 },

  // East Asia
  { countryCode: 'CN', countryName: 'Chiny', currency: 'CNY', dailyDiet: 55, accommodationLimit: 370 },
  { countryCode: 'JP', countryName: 'Japonia', currency: 'JPY', dailyDiet: 7281, accommodationLimit: 16000 },
  { countryCode: 'KR', countryName: 'Korea Płd.', currency: 'USD', dailyDiet: 52, accommodationLimit: 240 },

  // South & Southeast Asia
  { countryCode: 'IN', countryName: 'Indie', currency: 'USD', dailyDiet: 38, accommodationLimit: 190 },
  { countryCode: 'SG', countryName: 'Singapur', currency: 'SGD', dailyDiet: 69, accommodationLimit: 350 },
  { countryCode: 'TH', countryName: 'Tajlandia', currency: 'USD', dailyDiet: 37, accommodationLimit: 130 },
  { countryCode: 'VN', countryName: 'Wietnam', currency: 'USD', dailyDiet: 38, accommodationLimit: 160 },
  { countryCode: 'ID', countryName: 'Indonezja', currency: 'USD', dailyDiet: 42, accommodationLimit: 160 },

  // Oceania
  { countryCode: 'AU', countryName: 'Australia', currency: 'AUD', dailyDiet: 81, accommodationLimit: 250 },

  // Middle East
  { countryCode: 'AE', countryName: 'ZEA', currency: 'USD', dailyDiet: 50, accommodationLimit: 300 },
  { countryCode: 'SA', countryName: 'Arabia Saudyjska', currency: 'USD', dailyDiet: 50, accommodationLimit: 260 },
  { countryCode: 'IL', countryName: 'Izrael', currency: 'USD', dailyDiet: 60, accommodationLimit: 250 },

  // Africa
  { countryCode: 'EG', countryName: 'Egipt', currency: 'USD', dailyDiet: 45, accommodationLimit: 140 },
  { countryCode: 'ZA', countryName: 'RPA', currency: 'USD', dailyDiet: 42, accommodationLimit: 150 },
];

const VALID_FROM = new Date('2023-01-01');

export async function seedForeignRates(prisma: PrismaClient): Promise<void> {
  const existingCount = await prisma.foreignDietRate.count();
  if (existingCount > 0) {
    console.log(`Foreign diet rates already seeded (${existingCount} records found), skipping`);
    return;
  }

  for (const rate of FOREIGN_RATES) {
    await prisma.foreignDietRate.create({
      data: {
        countryCode: rate.countryCode,
        countryName: rate.countryName,
        currency: rate.currency,
        dailyDiet: rate.dailyDiet,
        accommodationLimit: rate.accommodationLimit,
        breakfastDeductionPct: 15,
        lunchDeductionPct: 30,
        dinnerDeductionPct: 30,
        validFrom: VALID_FROM,
        validTo: null,
      },
    });
  }

  console.log(`Seeded ${FOREIGN_RATES.length} foreign diet rates`);
}
