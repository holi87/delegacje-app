# Delegacje — Aplikacja do rozliczania podróży służbowych

Webowa aplikacja do rozliczania delegacji służbowych dla członków zarządu i wspólników spółki. Zgodna z polskim prawem.

## Funkcje

- Tworzenie i rozliczanie delegacji krajowych (Faza 1)
- Obliczanie diet wg aktualnych stawek (konfigurowalne w panelu admina)
- Kilometrówka z wyborem typu pojazdu
- Rozliczanie noclegów (wg rachunku / ryczałt)
- Koszty dodatkowe (parkingi, autostrady, inne)
- Pomniejszanie diet za zapewnione posiłki
- Generowanie PDF z pełnym rozliczeniem (do podpisu)
- Panel administracyjny (stawki, użytkownicy, dane firmy)
- Setup Wizard — konfiguracja przy pierwszym uruchomieniu (bez domyślnego admina w kodzie)
- Reset hasła admina z poziomu serwera (CLI)

## Stack technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui |
| Backend | Node.js 20, Fastify, TypeScript |
| Baza danych | PostgreSQL 16, Prisma ORM |
| PDF | PDFKit (server-side) |
| Auth | JWT (access + refresh token) |
| Infra | Docker, docker-compose |

## Szybki start

### Wymagania
- Docker + Docker Compose
- Node.js 20+ (do developmentu lokalnego)

### Uruchomienie (Docker)

```bash
# Klonuj repo
git clone <repo-url>
cd delegacje-app

# Uruchom (dev)
docker compose -f docker-compose.dev.yml up -d

# Lub produkcja
docker compose up -d --build
```

Aplikacja:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Przy pierwszym uruchomieniu pojawi się **Setup Wizard** — skonfiguruj firmę i konto admina.

### Uruchomienie lokalne (dev)

```bash
# 1. Baza danych
docker compose -f docker-compose.dev.yml up db -d

# 2. Backend
cd backend
cp .env.example .env          # Skonfiguruj DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate dev
npx prisma db seed             # Opcjonalnie: SEED_DEMO=true dla danych demo
npm run dev

# 3. Frontend
cd frontend
cp .env.example .env           # Skonfiguruj VITE_API_URL
npm install
npm run dev
```

## Konfiguracja

### Zmienne środowiskowe — Backend

| Zmienna | Opis | Przykład |
|---------|------|---------|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://user:pass@db:5432/delegacje` |
| `JWT_SECRET` | Klucz do podpisu JWT | `losowy-ciag-min-32-znaki` |
| `JWT_ACCESS_EXPIRY` | Ważność access tokena | `15m` |
| `JWT_REFRESH_EXPIRY` | Ważność refresh tokena | `7d` |
| `PORT` | Port backendu | `3001` |
| `SEED_DEMO` | Seed: dane demo (dev) | `true` / `false` |

### Zmienne środowiskowe — Frontend

| Zmienna | Opis | Przykład |
|---------|------|---------|
| `VITE_API_URL` | URL backendu | `http://localhost:3001/api/v1` |

## Pierwsze uruchomienie — Setup Wizard

Przy pierwszym uruchomieniu (pusta baza) aplikacja wyświetla Setup Wizard, który prowadzi przez:

1. **Dane firmy** — nazwa, NIP, adres
2. **Konto administratora** — email, hasło, dane osobowe
3. **Potwierdzenie stawek** — domyślne stawki wg rozporządzenia (edytowalne później)

Nie ma domyślnego konta admina w kodzie — Setup Wizard jest jedynym sposobem na utworzenie pierwszego administratora.

## Reset hasła administratora

W razie utraty hasła admin może je zresetować z poziomu serwera:

```bash
# Wyświetl listę adminów
docker compose exec backend npm run cli:list-admins

# Resetuj hasło (generuje losowe)
docker compose exec backend npm run cli:reset-password -- --email admin@firma.pl

# Resetuj z konkretnym hasłem
docker compose exec backend npm run cli:reset-password -- --email admin@firma.pl --password NoweHaslo123

# Resetuj hasło pierwszego admina (nie znasz emaila)
docker compose exec backend npm run cli:reset-password -- --first-admin
```

Nowe hasło wyświetli się na ekranie. Zmień je po pierwszym logowaniu.

## Dokumentacja techniczna

Szczegółowa dokumentacja w katalogu `docs/`:

| Plik | Zawartość |
|------|-----------|
| `docs/SPEC.md` | Specyfikacja funkcjonalna, przepisy, stawki |
| `docs/ARCHITECTURE.md` | Architektura, struktura katalogów, konwencje |
| `docs/DATABASE.md` | Schema Prisma, seed data |
| `docs/API.md` | Endpointy REST API |
| `docs/CALCULATION_RULES.md` | Algorytm obliczania diet z przykładami |
| `docs/PDF_TEMPLATE.md` | Układ generowanego PDF |
| `docs/SETUP_WIZARD.md` | Specyfikacja Setup Wizarda |
| `docs/ADMIN_RESET.md` | Specyfikacja CLI do resetu hasła |

## Użytkowanie

### Role
- **Admin** — zarządzanie stawkami, użytkownikami, firmą, podgląd/rozliczanie wszystkich delegacji
- **Delegowany** — tworzenie i rozliczanie własnych delegacji

### Cykl życia delegacji
```
SZKIC → ZŁOŻONA → ROZLICZONA
  ↑                    ↓
  └── (cofnięcie przez admina)
```

1. Delegowany tworzy delegację (wypełnia wizard krokowy)
2. Zapisuje jako szkic lub od razu składa
3. Admin weryfikuje i oznacza jako "Rozliczona"
4. Delegowany pobiera PDF, drukuje, podpisuje
5. Podpisany dokument przechowywany poza aplikacją (DMS)

### Generowanie PDF
- PDF generowany server-side (identyczny niezależnie od przeglądarki)
- Zawiera pełne rozliczenie: diety, noclegi, transport, koszty dodatkowe
- Miejsca na podpis delegowanego i zatwierdzającego
- Kwota do wypłaty słownie

## Podstawa prawna

- Rozporządzenie Ministra Pracy i Polityki Społecznej z 25.10.2022 r. w sprawie należności przysługujących pracownikowi z tytułu podróży służbowej (Dz.U. 2022 poz. 2302)
- Rozporządzenie Ministra Infrastruktury z 22.12.2022 r. w sprawie stawek za 1 km przebiegu pojazdu
- Art. 77⁵ Kodeksu pracy

**Aktualne stawki (od 01.01.2023, obowiązujące w 2026):**
- Dieta krajowa: 45 zł / dobę
- Kilometrówka (samochód > 900 cm³): 1,15 zł / km
- Ryczałt za nocleg: 67,50 zł
- Max nocleg wg rachunku: 900 zł

Stawki konfigurowane przez admina — przy zmianie przepisów wystarczy zaktualizować w panelu admina.

## Plan rozwoju

- **Faza 1** (obecna): Delegacje krajowe
- **Faza 2**: Delegacje zagraniczne (słownik diet wg krajów, przeliczanie walut)

## Licencja

Własnościowa / wewnętrzna. Do użytku w ramach spółki.

---

## Changelog

### [Unreleased]
- Setup Wizard przy pierwszym uruchomieniu (zamiast domyślnego admina w seedzie)
- CLI do resetu hasła admina (`reset-password.ts`)
- Faza 1: Pełne rozliczenie delegacji krajowych
  - Wizard krokowy do tworzenia delegacji (7 kroków)
  - Algorytm obliczania diet wg rozporządzenia (z pomniejszeniami za posiłki)
  - Kilometrówka (4 typy pojazdów, stawki konfigurowalne)
  - Rozliczanie noclegów (rachunek / ryczałt / bezpłatny)
  - Koszty dodatkowe (parkingi, autostrady, inne)
  - Zaliczki
  - Generowanie PDF z rozliczeniem (server-side, PDFKit)
  - Panel administracyjny:
    - Zarządzanie stawkami (diety, kilometrówka) z datą obowiązywania
    - Zarządzanie użytkownikami
    - Dane firmy (nagłówek PDF)
    - Podgląd i rozliczanie delegacji
  - Autentykacja JWT (access + refresh token)
  - Role: Admin / Delegowany
  - Docker + docker-compose (dev + prod)
