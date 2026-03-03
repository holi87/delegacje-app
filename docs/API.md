# API Endpoints

Base URL: `/api/v1`

## Setup (pierwszy start)

| Method | Path | Body | Response | Auth | Opis |
|--------|------|------|----------|------|------|
| GET | `/setup/status` | - | `{needsSetup: boolean}` | - | Czy wymaga konfiguracji (brak userów w DB) |
| POST | `/setup/init` | `{company, admin, rates}` | `{admin}` | - | Inicjalizacja (działa TYLKO gdy needsSetup=true) |

### POST /setup/init — body
```json
{
  "company": {
    "name": "Sp. z o.o.",
    "nip": "1234567890",
    "address": "ul. Przykładowa 1",
    "postalCode": "00-001",
    "city": "Warszawa"
  },
  "admin": {
    "email": "admin@firma.pl",
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

**Zabezpieczenia**: Endpoint zwraca 403 jeśli w bazie istnieje jakikolwiek użytkownik. Nie wymaga autentykacji (bo nie ma jeszcze żadnego konta).

## Auth

| Method | Path | Body | Response | Auth | Opis |
|--------|------|------|----------|------|------|
| POST | `/auth/login` | `{email, password}` | `{accessToken, user}` + refresh cookie | - | Logowanie |
| POST | `/auth/refresh` | - (cookie) | `{accessToken}` | - | Odświeżenie tokena |
| POST | `/auth/logout` | - | 204 | Bearer | Wylogowanie (czyszczenie cookie) |
| GET | `/auth/me` | - | `{user, profile}` | Bearer | Dane zalogowanego |

## Users (admin only)

| Method | Path | Body | Response | Opis |
|--------|------|------|----------|------|
| GET | `/users` | - | `{users[], total}` | Lista użytkowników |
| GET | `/users/:id` | - | `{user, profile}` | Szczegóły |
| POST | `/users` | `{email, password, role, profile}` | `{user}` | Tworzenie |
| PATCH | `/users/:id` | `{...partial}` | `{user}` | Edycja |
| DELETE | `/users/:id` | - | 204 | Dezaktywacja (soft) |

## Profile (own user)

| Method | Path | Body | Response | Opis |
|--------|------|------|----------|------|
| GET | `/profile` | - | `{profile}` | Mój profil |
| PATCH | `/profile` | `{firstName?, lastName?, ...}` | `{profile}` | Edycja profilu |
| PATCH | `/profile/password` | `{currentPassword, newPassword}` | 204 | Zmiana hasła |

## Delegations

| Method | Path | Body | Response | Auth | Opis |
|--------|------|------|----------|------|------|
| GET | `/delegations` | query: `?status=&page=&limit=` | `{delegations[], total}` | Bearer | Moje delegacje (lub wszystkie dla admina) |
| GET | `/delegations/:id` | - | `{delegation, days, costs, mileage, receipts}` | Bearer | Szczegóły delegacji |
| POST | `/delegations` | pełny obiekt delegacji | `{delegation}` | Bearer | Tworzenie (status=DRAFT) |
| PATCH | `/delegations/:id` | `{...partial}` | `{delegation}` | Bearer | Edycja (tylko DRAFT) |
| DELETE | `/delegations/:id` | - | 204 | Bearer | Usunięcie (tylko DRAFT) |
| POST | `/delegations/:id/submit` | - | `{delegation}` | Bearer | Zmiana statusu DRAFT → SUBMITTED |
| POST | `/delegations/:id/settle` | - | `{delegation}` | Admin | Zmiana statusu → SETTLED |
| POST | `/delegations/:id/reopen` | - | `{delegation}` | Admin | SETTLED → DRAFT (cofnięcie) |
| POST | `/delegations/:id/calculate` | - | `{calculation}` | Bearer | Przelicz (nie zapisuje, zwraca wynik) |
| GET | `/delegations/:id/pdf` | - | PDF binary (Content-Type: application/pdf) | Bearer | Generuj i pobierz PDF |

### Obiekt tworzenia delegacji (POST body)

```json
{
  "type": "DOMESTIC",
  "purpose": "Spotkanie z klientem",
  "destination": "Kraków",
  "departureAt": "2026-03-10T07:00:00Z",
  "returnAt": "2026-03-11T18:00:00Z",
  "transportType": "PRIVATE_VEHICLE",
  "vehicleType": "CAR_ABOVE_900",
  "accommodationType": "RECEIPT",
  "advanceAmount": 500.00,
  "days": [
    {
      "dayNumber": 1,
      "date": "2026-03-10",
      "breakfastProvided": false,
      "lunchProvided": false,
      "dinnerProvided": false,
      "accommodationType": "RECEIPT",
      "accommodationCost": 350.00
    },
    {
      "dayNumber": 2,
      "date": "2026-03-11",
      "breakfastProvided": true,
      "lunchProvided": false,
      "dinnerProvided": false,
      "accommodationType": "NONE",
      "accommodationCost": null
    }
  ],
  "mileageDetails": {
    "vehicleType": "CAR_ABOVE_900",
    "vehiclePlate": "WA 12345",
    "distanceKm": 620
  },
  "transportReceipts": [],
  "additionalCosts": [
    {
      "description": "Opłata za autostradę A4",
      "category": "highway",
      "amount": 52.00
    },
    {
      "description": "Parking Kraków centrum",
      "category": "parking",
      "amount": 35.00
    }
  ]
}
```

### Obiekt odpowiedzi /calculate

```json
{
  "duration": {
    "totalHours": 35.0,
    "fullDays": 1,
    "remainingHours": 11.0
  },
  "diet": {
    "rateUsed": 45.00,
    "days": [
      {
        "dayNumber": 1,
        "hours": 24.0,
        "baseAmount": 45.00,
        "deductions": {
          "breakfast": 0,
          "lunch": 0,
          "dinner": 0,
          "total": 0
        },
        "finalAmount": 45.00
      },
      {
        "dayNumber": 2,
        "hours": 11.0,
        "baseAmount": 22.50,
        "deductions": {
          "breakfast": 11.25,
          "lunch": 0,
          "dinner": 0,
          "total": 11.25
        },
        "finalAmount": 11.25
      }
    ],
    "total": 56.25
  },
  "accommodation": {
    "nights": [
      { "type": "RECEIPT", "amount": 350.00 }
    ],
    "total": 350.00
  },
  "transport": {
    "type": "PRIVATE_VEHICLE",
    "mileage": {
      "distanceKm": 620,
      "ratePerKm": 1.15,
      "total": 713.00
    },
    "receipts": [],
    "localTransportLumpSum": 0,
    "total": 713.00
  },
  "additionalCosts": {
    "items": [
      { "description": "Opłata za autostradę A4", "amount": 52.00 },
      { "description": "Parking Kraków centrum", "amount": 35.00 }
    ],
    "total": 87.00
  },
  "summary": {
    "dietTotal": 56.25,
    "accommodationTotal": 350.00,
    "transportTotal": 713.00,
    "additionalTotal": 87.00,
    "grandTotal": 1206.25,
    "advanceAmount": 500.00,
    "amountDue": 706.25
  }
}
```

## Admin: Rates

| Method | Path | Body | Response | Opis |
|--------|------|------|----------|------|
| GET | `/admin/rates/domestic` | - | `{rates[]}` | Lista stawek krajowych |
| POST | `/admin/rates/domestic` | `{dailyDiet, validFrom, ...}` | `{rate}` | Nowa stawka |
| PATCH | `/admin/rates/domestic/:id` | `{...partial}` | `{rate}` | Edycja stawki |
| GET | `/admin/rates/mileage` | - | `{rates[]}` | Stawki kilometrówki |
| POST | `/admin/rates/mileage` | `{vehicleType, ratePerKm, validFrom}` | `{rate}` | Nowa stawka km |
| PATCH | `/admin/rates/mileage/:id` | `{...partial}` | `{rate}` | Edycja |
| GET | `/admin/rates/foreign` | - | `{rates[]}` | Diety zagraniczne (Faza 2) |
| POST | `/admin/rates/foreign` | `{countryCode, ...}` | `{rate}` | Dodaj kraj |
| POST | `/admin/rates/foreign/import` | CSV/JSON body | `{imported: N}` | Import słownika |
| PATCH | `/admin/rates/foreign/:id` | `{...partial}` | `{rate}` | Edycja |
| DELETE | `/admin/rates/foreign/:id` | - | 204 | Usunięcie |

## Admin: Company

| Method | Path | Body | Response | Opis |
|--------|------|------|----------|------|
| GET | `/admin/company` | - | `{companyInfo}` | Dane firmy |
| PATCH | `/admin/company` | `{name?, nip?, ...}` | `{companyInfo}` | Edycja |

## Kody błędów

```json
{
  "statusCode": 422,
  "error": "Validation Error",
  "message": "Data powrotu musi być późniejsza niż data wyjazdu",
  "details": [
    { "field": "returnAt", "message": "Musi być po departureAt" }
  ]
}
```

Standardowe kody:
- 200 — OK
- 201 — Created
- 204 — No Content (delete, logout)
- 400 — Bad Request
- 401 — Unauthorized (brak/expired token)
- 403 — Forbidden (brak uprawnień)
- 404 — Not Found
- 422 — Validation Error
- 500 — Internal Server Error
