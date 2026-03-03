# Schema bazy danych

## Diagram ERD (tekstowy)

```
User 1──N Delegation
User 1──1 UserProfile
Delegation 1──N DelegationDay (posiłki per doba)
Delegation 1──N AdditionalCost
Delegation 1──1 MileageDetails (opcjonalnie)
DomesticRate 1──N (lookup, data obowiązywania)
MileageRate 1──N (lookup, per typ pojazdu)
ForeignDietRate 1──N (Faza 2, per kraj)
CompanyInfo (singleton)
```

## Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// =====================
// USERS
// =====================

enum Role {
  ADMIN
  DELEGATED
}

model User {
  id            String       @id @default(uuid())
  email         String       @unique
  passwordHash  String       @map("password_hash")
  role          Role         @default(DELEGATED)
  isActive      Boolean      @default(true) @map("is_active")
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")

  profile       UserProfile?
  delegations   Delegation[]

  @@map("users")
}

model UserProfile {
  id              String  @id @default(uuid())
  userId          String  @unique @map("user_id")
  firstName       String  @map("first_name")
  lastName        String  @map("last_name")
  position        String  // stanowisko: "Członek Zarządu", "Wspólnik" itp.
  defaultVehicle  VehicleType? @map("default_vehicle")
  vehiclePlate    String? @map("vehicle_plate")     // nr rejestracyjny
  vehicleCapacity String? @map("vehicle_capacity")   // pojemność silnika (opis)

  user            User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_profiles")
}

// =====================
// DELEGATIONS
// =====================

enum DelegationStatus {
  DRAFT       // Szkic — edytowalny
  SUBMITTED   // Złożona — czeka na rozliczenie
  SETTLED     // Rozliczona
}

enum DelegationType {
  DOMESTIC    // Krajowa
  FOREIGN     // Zagraniczna (Faza 2)
}

enum TransportType {
  COMPANY_VEHICLE     // Pojazd służbowy
  PUBLIC_TRANSPORT     // Transport publiczny (bilety)
  PRIVATE_VEHICLE      // Pojazd prywatny (kilometrówka)
  MIXED                // Mieszany
}

enum VehicleType {
  CAR_ABOVE_900     // Samochód > 900 cm³
  CAR_BELOW_900     // Samochód ≤ 900 cm³
  MOTORCYCLE        // Motocykl
  MOPED             // Motorower
}

enum AccommodationType {
  RECEIPT       // Zwrot wg rachunku
  LUMP_SUM      // Ryczałt
  FREE           // Zapewniony bezpłatnie
  NONE           // Brak noclegu
}

model Delegation {
  id              String            @id @default(uuid())
  userId          String            @map("user_id")
  type            DelegationType    @default(DOMESTIC)
  status          DelegationStatus  @default(DRAFT)

  // Dane podstawowe
  purpose         String            // Cel delegacji
  destination     String            // Miejsce delegacji
  departureAt     DateTime          @map("departure_at")    // Data+godzina wyjazdu
  returnAt        DateTime          @map("return_at")       // Data+godzina powrotu

  // Transport
  transportType       TransportType     @map("transport_type")
  vehicleType         VehicleType?      @map("vehicle_type")
  transportNotes      String?           @map("transport_notes")

  // Nocleg
  accommodationType   AccommodationType @default(NONE) @map("accommodation_type")
  accommodationNights Int               @default(0) @map("accommodation_nights")
  accommodationTotal  Decimal?          @db.Decimal(10, 2) @map("accommodation_total") // suma za noclegi

  // Zaliczka
  advanceAmount       Decimal           @default(0) @db.Decimal(10, 2) @map("advance_amount")

  // Obliczone wartości (wypełniane przez serwer)
  totalDiet           Decimal?          @db.Decimal(10, 2) @map("total_diet")
  totalAccommodation  Decimal?          @db.Decimal(10, 2) @map("total_accommodation")
  totalTransport      Decimal?          @db.Decimal(10, 2) @map("total_transport")
  totalAdditional     Decimal?          @db.Decimal(10, 2) @map("total_additional")
  grandTotal          Decimal?          @db.Decimal(10, 2) @map("grand_total")
  amountDue           Decimal?          @db.Decimal(10, 2) @map("amount_due") // do wypłaty (grand_total - advance)

  // Zagraniczne (Faza 2)
  foreignCountry      String?           @map("foreign_country")
  foreignCurrency     String?           @map("foreign_currency")

  // Meta
  settledAt           DateTime?         @map("settled_at")
  settledBy           String?           @map("settled_by") // userId admina, który rozliczył
  createdAt           DateTime          @default(now()) @map("created_at")
  updatedAt           DateTime          @updatedAt @map("updated_at")

  // Relacje
  user                User              @relation(fields: [userId], references: [id])
  days                DelegationDay[]
  additionalCosts     AdditionalCost[]
  mileageDetails      MileageDetails?
  transportReceipts   TransportReceipt[]

  @@index([userId])
  @@index([status])
  @@map("delegations")
}

// Posiłki per doba delegacji
model DelegationDay {
  id              String     @id @default(uuid())
  delegationId    String     @map("delegation_id")
  dayNumber       Int        @map("day_number")   // 1, 2, 3...
  date            DateTime   @db.Date              // konkretny dzień
  hoursInDay      Decimal    @db.Decimal(4, 2) @map("hours_in_day") // ile godzin w tej dobie

  // Zapewnione posiłki
  breakfastProvided Boolean  @default(false) @map("breakfast_provided")
  lunchProvided     Boolean  @default(false) @map("lunch_provided")
  dinnerProvided    Boolean  @default(false) @map("dinner_provided")

  // Nocleg w tym dniu
  accommodationType AccommodationType @default(NONE) @map("accommodation_type")
  accommodationCost Decimal?          @db.Decimal(10, 2) @map("accommodation_cost")

  // Obliczone
  dietBase          Decimal?  @db.Decimal(10, 2) @map("diet_base")     // dieta przed pomniejszeniem
  dietDeductions    Decimal?  @db.Decimal(10, 2) @map("diet_deductions") // kwota pomniejszeń
  dietFinal         Decimal?  @db.Decimal(10, 2) @map("diet_final")     // dieta po pomniejszeniu (min 0)

  delegation        Delegation @relation(fields: [delegationId], references: [id], onDelete: Cascade)

  @@unique([delegationId, dayNumber])
  @@map("delegation_days")
}

// Kilometrówka
model MileageDetails {
  id              String      @id @default(uuid())
  delegationId    String      @unique @map("delegation_id")
  vehicleType     VehicleType @map("vehicle_type")
  vehiclePlate    String      @map("vehicle_plate")
  distanceKm      Decimal     @db.Decimal(10, 1) @map("distance_km")
  ratePerKm       Decimal     @db.Decimal(5, 2) @map("rate_per_km")    // stawka na moment delegacji
  totalAmount     Decimal     @db.Decimal(10, 2) @map("total_amount")  // km × stawka

  delegation      Delegation  @relation(fields: [delegationId], references: [id], onDelete: Cascade)

  @@map("mileage_details")
}

// Bilety / rachunki za transport
model TransportReceipt {
  id              String     @id @default(uuid())
  delegationId    String     @map("delegation_id")
  description     String     // np. "Bilet PKP Warszawa-Kraków"
  amount          Decimal    @db.Decimal(10, 2)
  receiptNumber   String?    @map("receipt_number")

  delegation      Delegation @relation(fields: [delegationId], references: [id], onDelete: Cascade)

  @@map("transport_receipts")
}

// Koszty dodatkowe
model AdditionalCost {
  id              String     @id @default(uuid())
  delegationId    String     @map("delegation_id")
  description     String     // np. "Opłata za autostradę A2"
  category        String     // parking, highway, other
  amount          Decimal    @db.Decimal(10, 2)
  receiptNumber   String?    @map("receipt_number")

  delegation      Delegation @relation(fields: [delegationId], references: [id], onDelete: Cascade)

  @@map("additional_costs")
}

// =====================
// STAWKI (ADMIN)
// =====================

// Stawki diety krajowej
model DomesticRate {
  id              String    @id @default(uuid())
  dailyDiet       Decimal   @db.Decimal(10, 2) @map("daily_diet")           // 45.00
  accommodationLumpSum Decimal @db.Decimal(10, 2) @map("accommodation_lump_sum") // 67.50 (150% diety)
  accommodationMaxReceipt Decimal @db.Decimal(10, 2) @map("accommodation_max_receipt") // 900.00
  localTransportLumpSum Decimal @db.Decimal(10, 2) @map("local_transport_lump_sum") // 9.00 (20% diety)
  breakfastDeductionPct Int   @default(25) @map("breakfast_deduction_pct")    // 25%
  lunchDeductionPct     Int   @default(50) @map("lunch_deduction_pct")        // 50%
  dinnerDeductionPct    Int   @default(25) @map("dinner_deduction_pct")       // 25%
  validFrom       DateTime  @map("valid_from")
  validTo         DateTime? @map("valid_to")  // null = obowiązuje bezterminowo
  createdAt       DateTime  @default(now()) @map("created_at")

  @@map("domestic_rates")
}

// Stawki kilometrówki
model MileageRate {
  id              String      @id @default(uuid())
  vehicleType     VehicleType @map("vehicle_type")
  ratePerKm       Decimal     @db.Decimal(5, 2) @map("rate_per_km")
  validFrom       DateTime    @map("valid_from")
  validTo         DateTime?   @map("valid_to")
  createdAt       DateTime    @default(now()) @map("created_at")

  @@map("mileage_rates")
}

// Diety zagraniczne (Faza 2)
model ForeignDietRate {
  id                  String    @id @default(uuid())
  countryCode         String    @map("country_code")    // ISO 3166-1 alpha-2
  countryName         String    @map("country_name")    // np. "Niemcy"
  currency            String                             // np. "EUR"
  dailyDiet           Decimal   @db.Decimal(10, 2) @map("daily_diet")
  accommodationLimit  Decimal   @db.Decimal(10, 2) @map("accommodation_limit")
  breakfastDeductionPct Int     @default(15) @map("breakfast_deduction_pct")
  lunchDeductionPct     Int     @default(30) @map("lunch_deduction_pct")
  dinnerDeductionPct    Int     @default(30) @map("dinner_deduction_pct")
  validFrom           DateTime  @map("valid_from")
  validTo             DateTime? @map("valid_to")
  createdAt           DateTime  @default(now()) @map("created_at")

  @@unique([countryCode, validFrom])
  @@map("foreign_diet_rates")
}

// =====================
// FIRMA
// =====================

model CompanyInfo {
  id          String  @id @default(uuid())
  name        String  // Nazwa spółki
  nip         String  // NIP
  address     String  // Adres siedziby
  city        String
  postalCode  String  @map("postal_code")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("company_info")
}
```

## Seed data (backend/prisma/seed.ts)

Seed powinien zawierać:

### 1. Stawki diety krajowej (obowiązujące od 01.01.2023)
```
daily_diet: 45.00
accommodation_lump_sum: 67.50
accommodation_max_receipt: 900.00
local_transport_lump_sum: 9.00
breakfast_deduction_pct: 25
lunch_deduction_pct: 50
dinner_deduction_pct: 25
valid_from: 2023-01-01
valid_to: null
```

### 2. Stawki kilometrówki (obowiązujące od 17.01.2023)
```
CAR_ABOVE_900:  1.15
CAR_BELOW_900:  0.89
MOTORCYCLE:     0.69
MOPED:          0.42
valid_from: 2023-01-17
valid_to: null
```

### 3. Admin user
```
email: admin@firma.pl
password: (hashed) changeme123
role: ADMIN
first_name: Admin
last_name: Systemu
position: Administrator
```

### 4. Demo company
```
name: Przykładowa Sp. z o.o.
nip: 1234567890
address: ul. Przykładowa 1
city: Warszawa
postal_code: 00-001
```

## Migracje

Prisma zarządza migracjami automatycznie:
```bash
npx prisma migrate dev --name init    # tworzenie
npx prisma migrate deploy              # produkcja
npx prisma db seed                     # seed
```

## Indeksy i uwagi

- `delegations.user_id` — indeks do szybkiego filtrowania
- `delegations.status` — indeks do filtrowania po statusie
- `domestic_rates` i `mileage_rates` — lookup po `valid_from/valid_to` z użyciem zakresu dat delegacji
- Wszystkie kwoty: `Decimal(10,2)` — nigdy float!
- UUID jako PK wszędzie
