# Architektura Techniczna

## Stack technologiczny

### Frontend
- **React 18+** z TypeScript
- **Vite** jako bundler
- **TailwindCSS** + shadcn/ui (komponenty)
- **React Router v6** — routing
- **React Hook Form** + **Zod** — formularze i walidacja
- **TanStack Query (React Query)** — zarządzanie stanem serwerowym
- **date-fns** — operacje na datach (z locale `pl`)
- **Axios** — HTTP client

### Backend
- **Node.js** (20 LTS) + **Fastify** (framework HTTP)
- **TypeScript**
- **Prisma** — ORM
- **PostgreSQL 16** — baza danych
- **PDFKit** lub **jsPDF** (server-side) — generowanie PDF
- **bcrypt** — hashowanie haseł
- **jsonwebtoken** — JWT auth
- **Zod** — walidacja schematów

### Infrastructure
- **Docker** + **docker-compose** (dev + prod)
- Monorepo z dwoma pakietami: `frontend/` i `backend/`

## Struktura katalogów

```
delegacje-app/
├── CLAUDE.md                    # Instrukcje dla Claude Code
├── docker-compose.yml
├── docker-compose.dev.yml
├── docs/
│   ├── SPEC.md                  # Specyfikacja funkcjonalna
│   ├── ARCHITECTURE.md          # Ten plik
│   ├── DATABASE.md              # Schema DB
│   ├── API.md                   # Endpointy REST API
│   ├── CALCULATION_RULES.md     # Szczegóły algorytmu obliczeń
│   └── PDF_TEMPLATE.md          # Specyfikacja szablonu PDF
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts              # Seed: stawki, admin, dane demo
│   ├── src/
│   │   ├── index.ts             # Entry point Fastify
│   │   ├── cli/
│   │   │   └── reset-password.ts # CLI: reset hasła admina z poziomu serwera
│   │   ├── config/
│   │   │   └── env.ts
│   │   ├── plugins/
│   │   │   ├── auth.ts          # JWT plugin
│   │   │   ├── cors.ts
│   │   │   └── prisma.ts
│   │   ├── modules/
│   │   │   ├── setup/
│   │   │   │   ├── setup.routes.ts   # GET /setup/status, POST /setup/init
│   │   │   │   ├── setup.service.ts
│   │   │   │   └── setup.schema.ts
│   │   │   ├── auth/
│   │   │   │   ├── auth.routes.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── auth.schema.ts
│   │   │   ├── users/
│   │   │   │   ├── users.routes.ts
│   │   │   │   ├── users.service.ts
│   │   │   │   └── users.schema.ts
│   │   │   ├── delegations/
│   │   │   │   ├── delegations.routes.ts
│   │   │   │   ├── delegations.service.ts
│   │   │   │   ├── delegations.schema.ts
│   │   │   │   └── calculation.service.ts  # KLUCZOWY: algorytm obliczeń
│   │   │   ├── admin/
│   │   │   │   ├── rates.routes.ts
│   │   │   │   ├── rates.service.ts
│   │   │   │   ├── company.routes.ts
│   │   │   │   └── company.service.ts
│   │   │   └── pdf/
│   │   │       ├── pdf.routes.ts
│   │   │       ├── pdf.service.ts
│   │   │       └── pdf.template.ts  # Layout PDF
│   │   ├── middleware/
│   │   │   ├── authenticate.ts
│   │   │   └── authorize.ts     # Role check: admin vs delegowany
│   │   └── utils/
│   │       ├── date-helpers.ts
│   │       └── errors.ts
│   └── tests/
│       ├── calculation.test.ts  # Unit tests algorytmu
│       └── api/
│           └── delegations.test.ts
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── tailwind.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   ├── client.ts        # Axios instance
│       │   ├── auth.ts
│       │   ├── delegations.ts
│       │   └── admin.ts
│       ├── components/
│       │   ├── ui/              # shadcn components
│       │   ├── layout/
│       │   │   ├── AppShell.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   └── Header.tsx
│       │   ├── setup/
│       │   │   ├── SetupStepCompany.tsx
│       │   │   ├── SetupStepAdmin.tsx
│       │   │   ├── SetupStepRates.tsx
│       │   │   └── SetupStepConfirm.tsx
│       │   ├── delegation/
│       │   │   ├── DelegationWizard.tsx
│       │   │   ├── StepBasicInfo.tsx
│       │   │   ├── StepTransport.tsx
│       │   │   ├── StepAccommodation.tsx
│       │   │   ├── StepMeals.tsx
│       │   │   ├── StepAdditionalCosts.tsx
│       │   │   ├── StepAdvance.tsx
│       │   │   ├── StepSummary.tsx
│       │   │   └── DelegationList.tsx
│       │   └── admin/
│       │       ├── RatesManager.tsx
│       │       ├── UsersManager.tsx
│       │       ├── CompanySettings.tsx
│       │       └── DelegationOverview.tsx
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   └── useDelegation.ts
│       ├── pages/
│       │   ├── SetupWizardPage.tsx
│       │   ├── LoginPage.tsx
│       │   ├── DashboardPage.tsx
│       │   ├── NewDelegationPage.tsx
│       │   ├── DelegationDetailPage.tsx
│       │   ├── ProfilePage.tsx
│       │   └── admin/
│       │       ├── AdminRatesPage.tsx
│       │       ├── AdminUsersPage.tsx
│       │       ├── AdminCompanyPage.tsx
│       │       └── AdminDelegationsPage.tsx
│       ├── stores/
│       │   └── authStore.ts     # Zustand for auth state
│       ├── types/
│       │   └── index.ts
│       └── utils/
│           ├── formatters.ts    # PLN formatting, date formatting
│           └── validators.ts
└── shared/
    └── types.ts                 # Shared TypeScript types (delegacja, user, stawki)
```

## Konwencje

### Nazewnictwo
- Pliki: `kebab-case` dla TS/TSX
- Komponenty React: `PascalCase`
- Zmienne/funkcje: `camelCase`
- Stałe konfiguracyjne: `UPPER_SNAKE_CASE`
- Tabele DB (Prisma): `PascalCase` (model), `snake_case` (kolumny w SQL)

### Język
- **UI**: WSZYSTKO po polsku (labels, messages, errors, tooltips)
- **Kod**: angielski (nazwy zmiennych, funkcji, komentarze)
- **Modele DB**: angielski

### API
- REST
- Prefix: `/api/v1/`
- JSON request/response
- Status codes: 200, 201, 400, 401, 403, 404, 422, 500
- Paginacja: `?page=1&limit=20`

### Autentykacja
- JWT Bearer token w header `Authorization`
- Access token: 15 min
- Refresh token: 7 dni (httpOnly cookie)
- Endpoint: `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`

## Docker

### docker-compose.yml (prod):
```yaml
services:
  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: delegacje
      POSTGRES_USER: delegacje_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  backend:
    build: ./backend
    depends_on: [db]
    environment:
      DATABASE_URL: postgresql://delegacje_user:${DB_PASSWORD}@db:5432/delegacje
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "3001:3001"

  frontend:
    build: ./frontend
    depends_on: [backend]
    ports:
      - "3000:80"

volumes:
  pgdata:
```

### docker-compose.dev.yml:
- Dodaje hot-reload dla frontend i backend
- Mapuje volumes lokalne
- Otwiera port DB (5432) na hoście

## Kluczowe decyzje architektoniczne

1. **Monorepo bez narzędzia** (no Nx, no Turborepo) — prostota, 2 niezależne package.json
2. **Fastify > Express** — szybszy, lepsze TypeScript support, schema validation
3. **Prisma > TypeORM** — prostszy, lepszy DX, migracje deklaratywne
4. **Zustand > Redux** — prostszy state management (tylko auth state)
5. **React Query** — cały stan serwerowy, cache, refetch
6. **Wizard (krokowy formularz)** — lepsza UX niż jeden gigantyczny formularz
7. **Server-side PDF** — pewność, że PDF jest identyczny niezależnie od przeglądarki
8. **Stawki w DB (nie hardcoded)** — admin może zmieniać bez deploy
9. **Soft-delete delegacji po rozliczeniu** — flaga `settled`, nie kasowanie
