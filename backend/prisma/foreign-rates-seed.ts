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
  { countryCode: 'AD', countryName: 'Andorra', currency: 'EUR', dailyDiet: 50, accommodationLimit: 160 },
  { countryCode: 'LU', countryName: 'Luksemburg', currency: 'EUR', dailyDiet: 48, accommodationLimit: 161 },

  // Scandinavia
  { countryCode: 'NO', countryName: 'Norwegia', currency: 'NOK', dailyDiet: 476, accommodationLimit: 1800 },
  { countryCode: 'SE', countryName: 'Szwecja', currency: 'SEK', dailyDiet: 459, accommodationLimit: 1800 },
  { countryCode: 'DK', countryName: 'Dania', currency: 'DKK', dailyDiet: 406, accommodationLimit: 1400 },
  { countryCode: 'FI', countryName: 'Finlandia', currency: 'EUR', dailyDiet: 48, accommodationLimit: 160 },
  { countryCode: 'IS', countryName: 'Islandia', currency: 'CHF', dailyDiet: 71, accommodationLimit: 200 },

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
  { countryCode: 'BY', countryName: 'Białoruś', currency: 'EUR', dailyDiet: 42, accommodationLimit: 160 },
  { countryCode: 'MD', countryName: 'Mołdawia', currency: 'EUR', dailyDiet: 41, accommodationLimit: 100 },

  // Baltic States
  { countryCode: 'LT', countryName: 'Litwa', currency: 'EUR', dailyDiet: 39, accommodationLimit: 130 },
  { countryCode: 'LV', countryName: 'Łotwa', currency: 'EUR', dailyDiet: 42, accommodationLimit: 132 },
  { countryCode: 'EE', countryName: 'Estonia', currency: 'EUR', dailyDiet: 43, accommodationLimit: 130 },

  // South-Eastern Europe & Balkans
  { countryCode: 'GR', countryName: 'Grecja', currency: 'EUR', dailyDiet: 48, accommodationLimit: 140 },
  { countryCode: 'TR', countryName: 'Turcja', currency: 'USD', dailyDiet: 53, accommodationLimit: 175 },
  { countryCode: 'AL', countryName: 'Albania', currency: 'EUR', dailyDiet: 41, accommodationLimit: 120 },
  { countryCode: 'BA', countryName: 'Bośnia i Hercegowina', currency: 'EUR', dailyDiet: 41, accommodationLimit: 100 },
  { countryCode: 'ME', countryName: 'Czarnogóra', currency: 'EUR', dailyDiet: 40, accommodationLimit: 100 },
  { countryCode: 'MK', countryName: 'Macedonia Płn.', currency: 'EUR', dailyDiet: 38, accommodationLimit: 100 },
  { countryCode: 'CY', countryName: 'Cypr', currency: 'EUR', dailyDiet: 43, accommodationLimit: 140 },
  { countryCode: 'MT', countryName: 'Malta', currency: 'EUR', dailyDiet: 43, accommodationLimit: 130 },

  // Caucasus & Central Asia
  { countryCode: 'GE', countryName: 'Gruzja', currency: 'EUR', dailyDiet: 43, accommodationLimit: 140 },
  { countryCode: 'AM', countryName: 'Armenia', currency: 'EUR', dailyDiet: 41, accommodationLimit: 140 },
  { countryCode: 'AZ', countryName: 'Azerbejdżan', currency: 'EUR', dailyDiet: 43, accommodationLimit: 170 },
  { countryCode: 'KZ', countryName: 'Kazachstan', currency: 'EUR', dailyDiet: 40, accommodationLimit: 140 },
  { countryCode: 'UZ', countryName: 'Uzbekistan', currency: 'USD', dailyDiet: 40, accommodationLimit: 120 },
  { countryCode: 'TM', countryName: 'Turkmenistan', currency: 'USD', dailyDiet: 47, accommodationLimit: 130 },
  { countryCode: 'MN', countryName: 'Mongolia', currency: 'USD', dailyDiet: 45, accommodationLimit: 130 },

  // North America
  { countryCode: 'US', countryName: 'USA', currency: 'USD', dailyDiet: 59, accommodationLimit: 350 },
  { countryCode: 'CA', countryName: 'Kanada', currency: 'CAD', dailyDiet: 71, accommodationLimit: 250 },
  { countryCode: 'MX', countryName: 'Meksyk', currency: 'USD', dailyDiet: 50, accommodationLimit: 180 },

  // Central America & Caribbean
  { countryCode: 'GT', countryName: 'Gwatemala', currency: 'USD', dailyDiet: 42, accommodationLimit: 130 },
  { countryCode: 'CR', countryName: 'Kostaryka', currency: 'USD', dailyDiet: 50, accommodationLimit: 170 },
  { countryCode: 'PA', countryName: 'Panama', currency: 'USD', dailyDiet: 50, accommodationLimit: 170 },
  { countryCode: 'CU', countryName: 'Kuba', currency: 'EUR', dailyDiet: 42, accommodationLimit: 140 },
  { countryCode: 'JM', countryName: 'Jamajka', currency: 'USD', dailyDiet: 50, accommodationLimit: 180 },
  { countryCode: 'AG', countryName: 'Antigua i Barbuda', currency: 'USD', dailyDiet: 53, accommodationLimit: 250 },

  // South America
  { countryCode: 'BR', countryName: 'Brazylia', currency: 'USD', dailyDiet: 45, accommodationLimit: 170 },
  { countryCode: 'AR', countryName: 'Argentyna', currency: 'USD', dailyDiet: 50, accommodationLimit: 170 },
  { countryCode: 'CO', countryName: 'Kolumbia', currency: 'USD', dailyDiet: 42, accommodationLimit: 140 },
  { countryCode: 'PE', countryName: 'Peru', currency: 'USD', dailyDiet: 50, accommodationLimit: 170 },
  { countryCode: 'VE', countryName: 'Wenezuela', currency: 'USD', dailyDiet: 50, accommodationLimit: 170 },
  { countryCode: 'EC', countryName: 'Ekwador', currency: 'USD', dailyDiet: 42, accommodationLimit: 130 },
  { countryCode: 'BO', countryName: 'Boliwia', currency: 'USD', dailyDiet: 42, accommodationLimit: 120 },
  { countryCode: 'UY', countryName: 'Urugwaj', currency: 'USD', dailyDiet: 50, accommodationLimit: 130 },
  { countryCode: 'PY', countryName: 'Paragwaj', currency: 'USD', dailyDiet: 42, accommodationLimit: 100 },

  // East Asia
  { countryCode: 'CN', countryName: 'Chiny', currency: 'CNY', dailyDiet: 55, accommodationLimit: 370 },
  { countryCode: 'JP', countryName: 'Japonia', currency: 'JPY', dailyDiet: 7281, accommodationLimit: 16000 },
  { countryCode: 'KR', countryName: 'Korea Płd.', currency: 'USD', dailyDiet: 52, accommodationLimit: 240 },
  { countryCode: 'TW', countryName: 'Tajwan', currency: 'USD', dailyDiet: 43, accommodationLimit: 180 },

  // South & Southeast Asia
  { countryCode: 'IN', countryName: 'Indie', currency: 'USD', dailyDiet: 38, accommodationLimit: 190 },
  { countryCode: 'SG', countryName: 'Singapur', currency: 'SGD', dailyDiet: 69, accommodationLimit: 350 },
  { countryCode: 'TH', countryName: 'Tajlandia', currency: 'USD', dailyDiet: 37, accommodationLimit: 130 },
  { countryCode: 'VN', countryName: 'Wietnam', currency: 'USD', dailyDiet: 38, accommodationLimit: 160 },
  { countryCode: 'ID', countryName: 'Indonezja', currency: 'USD', dailyDiet: 42, accommodationLimit: 160 },
  { countryCode: 'PH', countryName: 'Filipiny', currency: 'USD', dailyDiet: 42, accommodationLimit: 170 },
  { countryCode: 'MY', countryName: 'Malezja', currency: 'USD', dailyDiet: 42, accommodationLimit: 170 },
  { countryCode: 'KH', countryName: 'Kambodża', currency: 'USD', dailyDiet: 37, accommodationLimit: 140 },
  { countryCode: 'LA', countryName: 'Laos', currency: 'USD', dailyDiet: 42, accommodationLimit: 100 },
  { countryCode: 'MM', countryName: 'Myanmar', currency: 'USD', dailyDiet: 42, accommodationLimit: 120 },
  { countryCode: 'BD', countryName: 'Bangladesz', currency: 'USD', dailyDiet: 42, accommodationLimit: 160 },
  { countryCode: 'LK', countryName: 'Sri Lanka', currency: 'USD', dailyDiet: 40, accommodationLimit: 140 },
  { countryCode: 'NP', countryName: 'Nepal', currency: 'USD', dailyDiet: 42, accommodationLimit: 120 },
  { countryCode: 'PK', countryName: 'Pakistan', currency: 'USD', dailyDiet: 38, accommodationLimit: 150 },

  // Oceania
  { countryCode: 'AU', countryName: 'Australia', currency: 'AUD', dailyDiet: 81, accommodationLimit: 250 },
  { countryCode: 'NZ', countryName: 'Nowa Zelandia', currency: 'NZD', dailyDiet: 75, accommodationLimit: 240 },

  // Middle East
  { countryCode: 'AE', countryName: 'ZEA', currency: 'USD', dailyDiet: 50, accommodationLimit: 300 },
  { countryCode: 'SA', countryName: 'Arabia Saudyjska', currency: 'USD', dailyDiet: 50, accommodationLimit: 260 },
  { countryCode: 'IL', countryName: 'Izrael', currency: 'USD', dailyDiet: 60, accommodationLimit: 250 },
  { countryCode: 'JO', countryName: 'Jordania', currency: 'USD', dailyDiet: 42, accommodationLimit: 140 },
  { countryCode: 'LB', countryName: 'Liban', currency: 'USD', dailyDiet: 51, accommodationLimit: 200 },
  { countryCode: 'IQ', countryName: 'Irak', currency: 'USD', dailyDiet: 46, accommodationLimit: 150 },
  { countryCode: 'IR', countryName: 'Iran', currency: 'USD', dailyDiet: 47, accommodationLimit: 180 },
  { countryCode: 'SY', countryName: 'Syria', currency: 'USD', dailyDiet: 50, accommodationLimit: 100 },
  { countryCode: 'KW', countryName: 'Kuwejt', currency: 'USD', dailyDiet: 42, accommodationLimit: 200 },
  { countryCode: 'QA', countryName: 'Katar', currency: 'USD', dailyDiet: 42, accommodationLimit: 200 },
  { countryCode: 'BH', countryName: 'Bahrajn', currency: 'USD', dailyDiet: 42, accommodationLimit: 200 },
  { countryCode: 'OM', countryName: 'Oman', currency: 'USD', dailyDiet: 42, accommodationLimit: 180 },

  // North Africa
  { countryCode: 'EG', countryName: 'Egipt', currency: 'USD', dailyDiet: 45, accommodationLimit: 140 },
  { countryCode: 'MA', countryName: 'Maroko', currency: 'EUR', dailyDiet: 41, accommodationLimit: 140 },
  { countryCode: 'TN', countryName: 'Tunezja', currency: 'EUR', dailyDiet: 39, accommodationLimit: 100 },
  { countryCode: 'DZ', countryName: 'Algeria', currency: 'EUR', dailyDiet: 50, accommodationLimit: 200 },
  { countryCode: 'LY', countryName: 'Libia', currency: 'USD', dailyDiet: 52, accommodationLimit: 130 },

  // Sub-Saharan Africa
  { countryCode: 'ZA', countryName: 'RPA', currency: 'USD', dailyDiet: 42, accommodationLimit: 150 },
  { countryCode: 'NG', countryName: 'Nigeria', currency: 'USD', dailyDiet: 46, accommodationLimit: 250 },
  { countryCode: 'KE', countryName: 'Kenia', currency: 'USD', dailyDiet: 40, accommodationLimit: 170 },
  { countryCode: 'ET', countryName: 'Etiopia', currency: 'USD', dailyDiet: 48, accommodationLimit: 200 },
  { countryCode: 'TZ', countryName: 'Tanzania', currency: 'USD', dailyDiet: 42, accommodationLimit: 150 },
  { countryCode: 'AO', countryName: 'Angola', currency: 'USD', dailyDiet: 51, accommodationLimit: 280 },
  { countryCode: 'CG', countryName: 'Kongo', currency: 'USD', dailyDiet: 55, accommodationLimit: 260 },
  { countryCode: 'MZ', countryName: 'Mozambik', currency: 'USD', dailyDiet: 42, accommodationLimit: 120 },
  { countryCode: 'RW', countryName: 'Rwanda', currency: 'USD', dailyDiet: 50, accommodationLimit: 180 },
  { countryCode: 'SN', countryName: 'Senegal', currency: 'EUR', dailyDiet: 46, accommodationLimit: 200 },
  { countryCode: 'ZW', countryName: 'Zimbabwe', currency: 'USD', dailyDiet: 52, accommodationLimit: 140 },

  // Afghanistan
  { countryCode: 'AF', countryName: 'Afganistan', currency: 'USD', dailyDiet: 47, accommodationLimit: 150 },
];

const VALID_FROM = new Date('2023-01-01');

export async function seedForeignRates(prisma: PrismaClient): Promise<void> {
  let created = 0;

  for (const rate of FOREIGN_RATES) {
    const existing = await prisma.foreignDietRate.findFirst({
      where: { countryCode: rate.countryCode, validTo: null },
    });
    if (!existing) {
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
      created++;
    }
  }

  if (created > 0) {
    console.log(`Seeded ${created} foreign diet rates`);
  } else {
    console.log('Foreign diet rates already seeded, skipping');
  }
}
