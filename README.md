# Delegacje — Aplikacja do rozliczania podróży służbowych

Webowa aplikacja do rozliczania delegacji służbowych dla członków zarządu i wspólników spółki. Zgodna z polskim prawem.

**Aktualna wersja:** `1.2.1` (2026-03-04)

## Funkcje

- Tworzenie i rozliczanie delegacji krajowych i zagranicznych
- Automatyczna numeracja delegacji (kolejny numer) + reset numeracji przez admina
- Opcjonalny własny numer delegacji podawany przez użytkownika (z walidacją unikalności)
- Obliczanie diet wg aktualnych stawek (konfigurowalne w panelu admina)
- Delegacje zagraniczne: dwuodcinkowy model (krajowy + zagraniczny), stawki per kraj
- Kilometrówka z wyborem typu pojazdu
- Rozliczanie noclegów (wg rachunku / ryczałt)
- Koszty dodatkowe (parkingi, autostrady, inne)
- Pomniejszanie diet za zapewnione posiłki
- Generowanie PDF z pełnym rozliczeniem (do podpisu)
- Panel administracyjny (stawki krajowe i zagraniczne, użytkownicy, dane firmy)
- Setup Wizard — konfiguracja przy pierwszym uruchomieniu (bez domyślnego admina w kodzie)
- Reset hasła admina z poziomu serwera (CLI)
- Rate limiting na API (ochrona przed brute force)
- Security headers (nginx)

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

### Ważne: seed stawek (w tym zagranicznych)

Po uruchomieniu kontenerów wykonaj:

```bash
docker compose exec backend npx prisma db seed
```

To polecenie uzupełnia słownik stawek zagranicznych (`foreign_diet_rates`) oraz stawki domyślne.

### Uruchomienie (Docker — dev)

```bash
git clone <repo-url>
cd delegacje-app

docker compose -f docker-compose.dev.yml up -d
```

### Wdrożenie produkcyjne (Docker)

```bash
# 1. Przygotuj zmienne środowiskowe
cat > .env <<EOF
DB_PASSWORD=$(openssl rand -base64 24)
JWT_SECRET=$(openssl rand -base64 48)
JWT_REFRESH_SECRET=$(openssl rand -base64 48)
CORS_ORIGIN=https://delegacje.twoja-domena.pl
EOF

# 2. Uruchom
docker compose up -d --build

# 3. Seed stawek (w tym zagranicznych)
docker compose exec backend npx prisma db seed
```

Aplikacja:
- Frontend: http://localhost:8250
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/api/v1/health
- Przy pierwszym uruchomieniu pojawi się **Setup Wizard** — skonfiguruj firmę i konto admina.

**Uwagi produkcyjne:**
- Przed frontendem postaw reverse proxy (nginx/Caddy) z SSL
- PostgreSQL healthcheck wbudowany w docker-compose — backend startuje po gotowości DB
- Rate limiting: 100 req/min globalnie, 5 req/15min na login
- Refresh tokeny rotowane przy każdym odświeżeniu (osobny sekret)

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
| `JWT_SECRET` | Klucz do podpisu JWT (min 32 znaki) | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | Klucz do podpisu refresh tokenów (min 32 znaki) | `openssl rand -base64 48` |
| `PORT` | Port backendu | `3001` |
| `HOST` | Adres nasłuchiwania | `0.0.0.0` |
| `NODE_ENV` | Środowisko | `development` / `production` |
| `CORS_ORIGIN` | URL frontendu (CORS) | `http://localhost:8250` |

### Zmienne środowiskowe — Frontend

| Zmienna | Opis | Przykład |
|---------|------|---------|
| `VITE_API_URL` | URL backendu (tylko dev lokalny) | `http://localhost:3001/api/v1` |

### Zmienne środowiskowe — Docker Compose (produkcja)

| Zmienna | Opis | Przykład |
|---------|------|---------|
| `DB_PASSWORD` | Hasło PostgreSQL | silne losowe hasło |
| `JWT_SECRET` | Klucz JWT (min 32 znaki) | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | Klucz refresh JWT (min 32 znaki) | `openssl rand -base64 48` |
| `CORS_ORIGIN` | URL frontendu | `https://delegacje.firma.pl` |

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

- **Faza 1** (zrealizowana): Delegacje krajowe
- **Faza 2** (zrealizowana): Delegacje zagraniczne (115 krajów, dwuodcinkowy model)
- **Faza 3** (planowana): Eksport do księgowości, powiadomienia email

## Licencja

Własnościowa / wewnętrzna. Do użytku w ramach spółki.

---

## Changelog

### [1.2.1] - 2026-03-04
- Noclegi (wizard):
  - Dodany wybór typu noclegu osobno dla każdej nocy (`Brak` / `Ryczałt` / `Wg rachunku` / `Bezpłatnie`)
  - Górny wybór typu noclegu działa jako „zastosuj do wszystkich nocy”
  - Poprawiona synchronizacja danych noclegów, aby nie gubić wyliczeń przy pierwszym przejściu do podsumowania
- PDF:
  - Stopka z metką aplikacji (`Delegacje-APP v1.2.1 / repo`) renderowana w tej samej stronie dokumentu (bez wypychania na kolejną stronę)

### [1.2.0] - 2026-03-04
- Personalizacja i identyfikacja dokumentów:
  - Zmieniony placeholder numeru delegacji na neutralny wzorzec `XYZ_DK_001`
  - Stopka PDF rozszerzona o metkę aplikacji: `Delegacje-APP v1.2.0 / https://github.com/holi87/delegacje-app`
- Poprawki językowe PDF:
  - Ujednolicenie polskich znaków diakrytycznych w stałych etykietach i opisach (np. `wypłaty`, `podróży`, `oświadczam`)
  - Poprawa zapisu kwoty słownie (`zł`, `tysiąc`, `tysięcy`, itd.)

### [1.1.0] - 2026-03-04
- Poprawki stabilizacyjne i UX:
  - Naprawa błędu 500 przy logowaniu (JWT refresh token)
  - Frontend wystawiony na porcie `8250` (konfiguracja + dokumentacja)
  - Poprawiona obsługa seeda i stawek zagranicznych (115 krajów)
  - Naprawa walidacji daty powrotu w kreatorze delegacji
  - Naprawa mapowania odpowiedzi `/delegations/:id/calculate` (znikające obliczenia)
  - Naprawa błędu `Cannot read properties of undefined (reading 'fullDays')`
  - Poprawki PDF: polskie znaki, godziny wyjazdu/powrotu, korekta tekstu `45,00 zł / doba`
  - Wczytywanie istniejących danych firmy do formularza administracyjnego
  - Prawidłowa edycja delegacji na istniejącym rekordzie (`/delegations/:id/edit`)
  - Poprawne symbole walut dla delegacji zagranicznych (np. `AUD` zamiast `zł`)
  - Rozdzielenie krajowych i zagranicznych limitów/ryczałtów noclegowych w UI
  - Trwała numeracja delegacji (DB), widoczna w aplikacji i PDF + reset numeru przez admina
  - Obsługa własnych numerów delegacji (np. `XYZ_DK_001`) z fallbackiem do numeru automatycznego

### [1.0.0] - 2026-03-03
- Faza 2: Delegacje zagraniczne
  - Dwuodcinkowy model obliczania (odcinek krajowy + zagraniczny)
  - 115 krajów z oficjalnymi stawkami diet i limitami noclegów
  - Progi godzinowe zagraniczne: ≤8h = 1/3, 8-12h = 1/2, >12h = 100%
  - Pomniejszenia za posiłki zagraniczne: 15% / 30% / 30%
  - CRUD stawek zagranicznych w panelu admina
  - Wizard: wybór typu delegacji, kraju, czasów przekroczenia granicy
  - PDF: warunkowy layout zagraniczny ze split-tabelą diet
  - 38 testów jednostkowych dla obliczeń zagranicznych (69 łącznie)
- Hardening produkcyjny:
  - Rate limiting (100 req/min globalnie, 5 req/15min na login)
  - Rotacja refresh tokenów + osobny sekret JWT
  - Nginx security headers (X-Frame-Options, X-Content-Type-Options, etc.)
  - Health check z weryfikacją połączenia z bazą danych
  - Error Boundary w React + strona 404
  - Docker: PostgreSQL healthcheck, parametryzowalny CORS_ORIGIN
  - Pliki .env.example dla backend i frontend
  - Seed idempotentny per-rekord (odporny na partial failure)
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
    - Zarządzanie stawkami (diety krajowe, zagraniczne, kilometrówka)
    - Zarządzanie użytkownikami
    - Dane firmy (nagłówek PDF)
    - Podgląd i rozliczanie delegacji
  - Autentykacja JWT (access + refresh token z rotacją)
  - Role: Admin / Delegowany
  - Docker + docker-compose (dev + prod)
