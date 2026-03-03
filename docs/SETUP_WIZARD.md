# Setup Wizard & Admin Bootstrap

## Koncepcja

Przy pierwszym uruchomieniu aplikacji (pusta baza, brak użytkowników) zamiast ekranu logowania wyświetla się **Setup Wizard** — jednorazowy kreator konfiguracji początkowej.

## Wykrywanie pierwszego uruchomienia

Backend sprawdza przy starcie:
```typescript
async function isFirstRun(): Promise<boolean> {
  const userCount = await prisma.user.count();
  return userCount === 0;
}
```

Endpoint:
```
GET /api/v1/setup/status
Response: { "needsSetup": true/false }
```

- `needsSetup: true` → frontend pokazuje Setup Wizard
- `needsSetup: false` → frontend pokazuje Login

**WAŻNE**: Endpoint `/api/v1/setup/init` działa TYLKO gdy `needsSetup === true`. Po utworzeniu pierwszego admina endpoint zwraca 403.

## Kroki Setup Wizard

### Krok 1: Dane firmy
```
Nazwa spółki:     [________________]
NIP:              [________________]
Adres:            [________________]
Kod pocztowy:     [______]
Miasto:           [________________]
```

### Krok 2: Konto administratora
```
Imię:             [________________]
Nazwisko:         [________________]
Email:            [________________]
Hasło:            [________________]
Powtórz hasło:    [________________]
Stanowisko:       [________________]  (domyślnie: "Administrator")
```

### Krok 3: Potwierdzenie stawek
Wyświetl domyślne stawki (wbudowane w kod jako fallback):
```
Dieta krajowa:          45,00 zł / dobę
Ryczałt za nocleg:      67,50 zł (150% diety)
Max nocleg wg rachunku: 900,00 zł
Ryczałt za dojazdy:     9,00 zł (20% diety)

Kilometrówka:
  Samochód > 900 cm³:   1,15 zł/km
  Samochód ≤ 900 cm³:   0,89 zł/km
  Motocykl:              0,69 zł/km
  Motorower:             0,42 zł/km

Pomniejszenia diety za posiłki:
  Śniadanie: 25%    Obiad: 50%    Kolacja: 25%

[ ] Akceptuję powyższe stawki (mogę je zmienić później w panelu admina)
```
Admin może opcjonalnie zmienić stawki od razu lub zaakceptować domyślne.

### Krok 4: Podsumowanie
```
Firma:  Przykładowa Sp. z o.o. (NIP: 1234567890)
Admin:  Jan Kowalski (jan@firma.pl)
Stawki: Domyślne (2023-01-01)

        [Utwórz konfigurację]
```

## API Setup

```
POST /api/v1/setup/init
```

Body:
```json
{
  "company": {
    "name": "Przykładowa Sp. z o.o.",
    "nip": "1234567890",
    "address": "ul. Przykładowa 1",
    "postalCode": "00-001",
    "city": "Warszawa"
  },
  "admin": {
    "email": "jan@firma.pl",
    "password": "SecurePass123!",
    "firstName": "Jan",
    "lastName": "Kowalski",
    "position": "Administrator"
  },
  "rates": {
    "useDefaults": true
  }
}
```

Albo z custom stawkami:
```json
{
  "company": { ... },
  "admin": { ... },
  "rates": {
    "useDefaults": false,
    "domestic": {
      "dailyDiet": 45.00,
      "breakfastDeductionPct": 25,
      "lunchDeductionPct": 50,
      "dinnerDeductionPct": 25,
      "validFrom": "2023-01-01"
    },
    "mileage": [
      { "vehicleType": "CAR_ABOVE_900", "ratePerKm": 1.15 },
      { "vehicleType": "CAR_BELOW_900", "ratePerKm": 0.89 },
      { "vehicleType": "MOTORCYCLE", "ratePerKm": 0.69 },
      { "vehicleType": "MOPED", "ratePerKm": 0.42 }
    ]
  }
}
```

Response (201):
```json
{
  "message": "Konfiguracja początkowa zakończona pomyślnie",
  "admin": { "id": "...", "email": "jan@firma.pl" }
}
```

## Zabezpieczenia

1. Endpoint `/setup/init` → 403 jeśli istnieje jakikolwiek user w DB
2. Endpoint `/setup/status` → publiczny, zawsze dostępny
3. Nie zapisuj surowego hasła w logach
4. Setup Wizard NIE jest częścią seeda — seed jest opcjonalny i tylko do dev/demo

## Zmiany w Prisma seed

Seed (`prisma/seed.ts`) zmienia rolę:
- **Nie tworzy** admina ani danych firmy (to robi Setup Wizard)
- Seed tworzy TYLKO domyślne stawki jako fallback (jeśli tabele stawek są puste)
- W trybie dev/test seed może opcjonalnie utworzyć demo-admina za flagą `SEED_DEMO=true`

```typescript
// prisma/seed.ts
async function main() {
  // Zawsze: wstaw domyślne stawki jeśli brak
  const rateCount = await prisma.domesticRate.count();
  if (rateCount === 0) {
    await seedDefaultRates();
  }

  // Opcjonalnie: demo data
  if (process.env.SEED_DEMO === 'true') {
    await seedDemoAdmin();
    await seedDemoCompany();
    await seedDemoDelegations();
  }
}
```

## Frontend routing

```typescript
// App.tsx — top-level routing
function App() {
  const { data } = useQuery(['setup-status'], fetchSetupStatus);

  if (data?.needsSetup) {
    return <SetupWizard />;
  }

  return <AuthenticatedApp />;
}
```

Komponenty:
```
frontend/src/pages/SetupWizardPage.tsx
frontend/src/components/setup/
  ├── SetupStepCompany.tsx
  ├── SetupStepAdmin.tsx
  ├── SetupStepRates.tsx
  └── SetupStepConfirm.tsx
```
