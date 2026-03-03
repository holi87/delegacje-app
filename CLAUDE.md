# CLAUDE.md — Delegacje App

## Projekt

Webowa aplikacja do rozliczania delegacji służbowych dla członków zarządu i wspólników spółki z o.o. Zgodna z polskim prawem (Rozporządzenie MPiPS z 25.10.2022, Dz.U. 2022 poz. 2302).

## Dokumentacja

PRZECZYTAJ TE PLIKI ZANIM ZACZNIESZ COKOLWIEK PISAĆ:

1. `docs/SPEC.md` — Pełna specyfikacja funkcjonalna, stawki, przepisy
2. `docs/ARCHITECTURE.md` — Stack techniczny, struktura katalogów, konwencje
3. `docs/DATABASE.md` — Schema Prisma, seed data, ERD
4. `docs/API.md` — Endpointy REST API, formaty request/response
5. `docs/CALCULATION_RULES.md` — **KLUCZOWY**: algorytm obliczania diet, noclegów, transportu z przykładami testowymi
6. `docs/PDF_TEMPLATE.md` — Układ i specyfikacja generowanego PDF
7. `docs/SETUP_WIZARD.md` — Setup Wizard przy pierwszym uruchomieniu (tworzenie admina, firmy, stawek)
8. `docs/ADMIN_RESET.md` — CLI tool do resetu hasła admina z poziomu serwera/Dockera

## Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui + React Query + React Hook Form + Zod
- **Backend**: Node.js 20 + Fastify + TypeScript + Prisma + PostgreSQL 16
- **PDF**: PDFKit (server-side) z fontem obsługującym polskie znaki
- **Auth**: JWT (access + refresh token)
- **Infra**: Docker + docker-compose

## Kluczowe zasady

### Język
- **UI (labels, buttony, komunikaty, walidacje)**: PO POLSKU
- **Kod (zmienne, funkcje, komentarze, commity)**: PO ANGIELSKU
- **Modele DB**: po angielsku

### Kwoty pieniężne
- NIGDY nie używaj `float` ani `number` do kwot
- Backend: `Decimal` (Prisma) → `string` w JSON
- Frontend: parsuj do `number` dopiero do wyświetlenia, formatuj z `Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })`
- W PDF: separator dziesiętny = przecinek, tysięcy = spacja

### Obliczenia delegacji
- **NAJWAŻNIEJSZE**: Pomniejszenie diety za posiłki liczy się ZAWSZE od PEŁNEJ diety (45 zł), nawet jeśli za daną dobę przysługuje tylko 50% diety
- Wynik pomniejszenia nie może być ujemny (min 0 zł per doba)
- Doba delegacyjna liczy się od godziny wyjazdu, NIE od północy
- Stawki pobierane z DB na podstawie daty delegacji (nie hardcoded!)
- Przeczytaj `docs/CALCULATION_RULES.md` — tam są przykłady testowe

### Walidacja
- Waliduj ZAWSZE po stronie backend (Zod schema)
- Frontend waliduje dla UX, ale backend jest źródłem prawdy
- Data powrotu > data wyjazdu
- Kwoty >= 0
- Kilometrówka: km > 0, wymagane dane pojazdu

### Bezpieczeństwo
- Hasła: bcrypt, min 8 znaków
- JWT: access 15min, refresh 7d (httpOnly cookie)
- Middleware auth: sprawdź token PRZED każdym chronionym endpointem
- Middleware authorize: admin-only routes sprawdzają `role === 'ADMIN'`
- Delegowany widzi TYLKO swoje delegacje
- Admin widzi wszystkie

### PDF
- Font z obsługą polskich znaków (DejaVu Sans lub zarejestrowany TTF)
- Daty: DD.MM.RRRR
- Kwota słownie po polsku w podsumowaniu
- Numeracja: DEL/{rok}/{numer_4cyfrowy}
- Generowany server-side, zwracany jako binary PDF
- Układ: patrz `docs/PDF_TEMPLATE.md`

## Struktura katalogów

```
delegacje-app/
├── CLAUDE.md
├── README.md                    # Opis projektu + changelog
├── docker-compose.yml
├── docker-compose.dev.yml
├── docs/                        # NIE MODYFIKUJ — to specyfikacja
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma        # Schema z docs/DATABASE.md
│   │   └── seed.ts              # TYLKO stawki domyślne (NIE admin!)
│   └── src/
│       ├── index.ts
│       ├── cli/
│       │   └── reset-password.ts # CLI do resetu hasła admina
│       ├── config/
│       ├── plugins/
│       ├── modules/
│       │   ├── auth/
│       │   ├── setup/            # Setup Wizard endpoints
│       │   │   ├── setup.routes.ts
│       │   │   ├── setup.service.ts
│       │   │   └── setup.schema.ts
│       │   ├── users/
│       │   ├── delegations/
│       │   │   └── calculation.service.ts  # CORE LOGIC
│       │   ├── admin/
│       │   └── pdf/
│       ├── middleware/
│       └── utils/
├── frontend/
│   └── src/
│       ├── api/
│       ├── components/
│       │   ├── setup/            # Setup Wizard components
│       │   │   ├── SetupStepCompany.tsx
│       │   │   ├── SetupStepAdmin.tsx
│       │   │   ├── SetupStepRates.tsx
│       │   │   └── SetupStepConfirm.tsx
│       │   ├── delegation/       # Wizard krokowy
│       │   └── admin/
│       ├── hooks/
│       ├── pages/
│       │   ├── SetupWizardPage.tsx
│       │   ├── LoginPage.tsx
│       │   └── ...
│       ├── stores/
│       └── types/
└── shared/
    └── types.ts
```

## Kolejność implementacji (Faza 1)

### Etap 1: Infrastruktura
1. Stwórz `package.json` dla backend i frontend
2. Docker-compose z PostgreSQL
3. Prisma schema + migracja
4. Seed: TYLKO domyślne stawki (NIE tworzy admina — admin tworzony przez Setup Wizard)
5. Konfiguracja Fastify (CORS, plugins)
6. Konfiguracja Vite + Tailwind + shadcn

### Etap 2: Setup Wizard + Auth
1. Endpoint `GET /api/v1/setup/status` — sprawdza czy baza pusta
2. Endpoint `POST /api/v1/setup/init` — tworzy admina + firmę + stawki (działa TYLKO gdy brak userów)
3. Frontend: SetupWizardPage z 4 krokami (firma, admin, stawki, potwierdzenie)
4. Endpointy auth (login, refresh, logout, me)
5. JWT middleware
6. Frontend: login page, auth store (Zustand), protected routes
7. Routing: jeśli `needsSetup=true` → Setup Wizard, inaczej → Login

### Etap 3: CLI reset hasła
1. `backend/src/cli/reset-password.ts` — patrz docs/ADMIN_RESET.md
2. npm scripts: `cli:reset-password`, `cli:list-admins`
3. Upewnij się że CLI działa przez `docker compose exec`

### Etap 4: Core — Delegacje
1. `calculation.service.ts` — algorytm obliczania (ZACZNIJ OD TEGO)
2. Testy jednostkowe dla calculation service (przykłady z CALCULATION_RULES.md)
3. CRUD delegacji (routes, service, schema)
4. Endpointy /calculate i /submit, /settle

### Etap 5: Frontend — Wizard
1. Layout (AppShell, Sidebar, Header)
2. Dashboard — lista delegacji
3. Wizard krokowy (7 kroków z docs/SPEC.md §9)
4. Podsumowanie z live-preview obliczeń
5. Akcje: zapisz szkic, złóż, pobierz PDF

### Etap 6: Panel Admin
1. Zarządzanie stawkami (CRUD)
2. Zarządzanie użytkownikami
3. Dane firmy
4. Podgląd wszystkich delegacji + zmiana statusu

### Etap 7: Generowanie PDF
1. PDFKit setup z polskim fontem
2. Implementacja szablonu z docs/PDF_TEMPLATE.md
3. Endpoint GET /delegations/:id/pdf
4. Przycisk "Pobierz PDF" w UI

### Etap 8: Polish & Testing
1. Error handling (toast notifications)
2. Loading states
3. Responsywność
4. E2E happy path test

## Komendy

```bash
# Dev
docker compose -f docker-compose.dev.yml up -d   # Start DB + services
cd backend && npm run dev                          # Backend dev server
cd frontend && npm run dev                         # Frontend dev server

# DB
cd backend && npx prisma migrate dev               # Run migrations
cd backend && npx prisma db seed                   # Seed data
cd backend && npx prisma studio                    # DB browser

# Test
cd backend && npm test                             # Unit tests
cd backend && npm run test:watch                   # Watch mode

# Build
cd backend && npm run build
cd frontend && npm run build

# Docker prod
docker compose up -d --build
```

## Ważne edge cases

1. Delegacja < 8h → dieta = 0, ale koszty transportu i dodatkowe nadal się liczą
2. Pomniejszenie za posiłki > przysługującej diety → dieta = 0 (nie ujemna!)
3. Nocleg wg rachunku > 900 zł → flaguj jako wymagający zgody admina
4. Zaliczka > sumy kosztów → kwota do wypłaty ujemna (delegowany zwraca różnicę)
5. Zmiana stawek w panelu admina NIE wpływa na już rozliczone delegacje (stawka jest "zamrożona" w momencie obliczenia)
6. Użytkownik nie może edytować delegacji w statusie SUBMITTED lub SETTLED
7. Tylko admin może cofnąć status SETTLED → DRAFT (reopen)

## Faza 2 (nie implementuj teraz, ale uwzględnij w architekturze)

- Delegacje zagraniczne — model `ForeignDietRate` już w schema
- Enum `DelegationType` (DOMESTIC | FOREIGN) już w schema
- Pola `foreignCountry`, `foreignCurrency` w modelu Delegation
- Inne progi godzinowe (1/3, 1/2, 100%) i inne procenty pomniejszeń (15%, 30%, 30%)
- Import słownika diet zagranicznych z CSV
