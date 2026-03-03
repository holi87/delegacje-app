# Aplikacja do Rozliczania Delegacji — Specyfikacja

## 1. Cel aplikacji

Webowa aplikacja do rozliczania delegacji służbowych dla członków zarządu i wspólników spółki. Musi być zgodna z obowiązującymi przepisami polskiego prawa (Rozporządzenie Ministra Pracy i Polityki Społecznej z 25.10.2022, Dz.U. 2022 poz. 2302 oraz Rozporządzenie Ministra Infrastruktury z 22.12.2022 w sprawie stawek kilometrówki).

## 2. Fazy realizacji

### Faza 1: Delegacje krajowe (MVP)
- Pełne rozliczenie delegacji na terenie Polski
- Kilometrówka
- Generowanie PDF z rozliczeniem
- Panel administracyjny

### Faza 2: Delegacje zagraniczne
- Słownik diet zagranicznych (wg krajów z załącznika do rozporządzenia)
- Przeliczanie walut
- Odmienny algorytm naliczania diet (1/3, 1/2, pełna)
- Czas podróży zagranicznej liczony od przekroczenia granicy / wylotu z Polski

## 3. Użytkownicy i role

### Role:
- **Admin** — zarządzanie stawkami, słownikami, użytkownikami, podgląd wszystkich delegacji
- **Delegowany** (członek zarządu / wspólnik) — tworzenie i rozliczanie własnych delegacji

### Uwagi dotyczące członków zarządu i wspólników:
- Nie są pracownikami w rozumieniu KP, ale spółka może ustalić w regulaminie wewnętrznym zasady rozliczania delegacji wg stawek z rozporządzenia (art. 775 § 3 KP przez analogię lub uchwała zarządu/zgromadzenia wspólników)
- Aplikacja NIE zajmuje się kwestią, czy delegacja jest kosztem podatkowym — to domena księgowości

## 4. Przepisy i stawki — Faza 1 (delegacje krajowe, stan na 2026)

### 4.1. Dieta krajowa
- **Pełna dieta**: 45 zł / dobę
- Podróż ≤ 1 doby:
  - < 8h → dieta NIE przysługuje (0 zł)
  - 8–12h → 50% diety (22,50 zł)
  - > 12h → 100% diety (45 zł)
- Podróż > 1 doby:
  - Każda pełna doba → 100% diety (45 zł)
  - Niepełna, rozpoczęta doba:
    - ≤ 8h → 50% diety (22,50 zł)
    - > 8h → 100% diety (45 zł)

### 4.2. Pomniejszenie diety za zapewnione posiłki
Podstawą pomniejszenia jest ZAWSZE pełna dieta (45 zł), niezależnie od tego, jaki ułamek diety przysługuje za daną dobę:
- Śniadanie: **25%** pełnej diety = 11,25 zł
- Obiad: **50%** pełnej diety = 22,50 zł
- Kolacja: **25%** pełnej diety = 11,25 zł
- Pełne wyżywienie → dieta = 0 zł

**WAŻNE**: Jeśli pracownik korzysta z hotelu ze śniadaniem — potrącenie stosuje się odpowiednio, nawet jeśli na fakturze nie jest to wyodrębnione.

### 4.3. Nocleg
- **Zwrot wg rachunku**: do 20× dieta = max 900 zł / dobę
  - Przekroczenie limitu możliwe za zgodą pracodawcy (admin)
- **Ryczałt za nocleg** (bez rachunku): 150% diety = 67,50 zł
  - Warunki: nocleg między 21:00 a 7:00, min. 6 godzin
- Ryczałt NIE przysługuje, gdy:
  - pracodawca zapewnił bezpłatny nocleg
  - nocleg w czasie przejazdu
  - pracodawca uznał, że delegowany mógł wrócić do domu

### 4.4. Przejazdy / Transport
- **Środek transportu**: określa zlecający (admin/zarząd)
- **Zwrot wg biletów/faktur**: pełna kwota
- **Kilometrówka** (pojazd prywatny za zgodą):
  - Samochód > 900 cm³: **1,15 zł/km**
  - Samochód ≤ 900 cm³: **0,89 zł/km**
  - Motocykl: **0,69 zł/km**
  - Motorower: **0,42 zł/km**
- **Ryczałt za dojazdy komunikacją miejską**: 20% diety = 9 zł / dobę

### 4.5. Koszty dodatkowe
- Opłaty parkingowe (za rachunkiem)
- Opłaty za autostrady/drogi płatne (za rachunkiem)
- Inne udokumentowane, uzasadnione wydatki

### 4.6. Zaliczka
- Delegowany może wnioskować o zaliczkę przed wyjazdem
- Rozliczenie zaliczki przy rozliczeniu delegacji

## 5. Algorytm obliczania delegacji krajowej

```
WEJŚCIE:
  - data_godzina_wyjazdu
  - data_godzina_powrotu
  - zapewnione_posilki[] (per doba: sniadanie, obiad, kolacja)
  - nocleg_typ (rachunek / ryczalt / brak)
  - nocleg_kwota (jeśli rachunek)
  - liczba_noclegów
  - transport_typ (sluzbowy / bilety / kilometrowka / ryczalt_dojazdy)
  - pojazd_typ (samochod_powyzej900 / samochod_ponizej900 / motocykl / motorower)
  - km_przejechane
  - koszty_biletów
  - koszty_dodatkowe[] (typ, kwota, opis)
  - zaliczka_kwota

ALGORYTM:
  1. Oblicz czas_trwania = data_godzina_powrotu - data_godzina_wyjazdu
  2. Rozłóż na pełne doby + resztę godzin
  3. Nalicz diety za każdą dobę wg zasad (4.1)
  4. Za każdą dobę pomniejsz o zapewnione posiłki wg (4.2)
  5. Suma diet NIE MOŻE być ujemna (min 0 zł per doba)
  6. Oblicz nocleg wg (4.3)
  7. Oblicz transport wg (4.4)
  8. Dodaj koszty dodatkowe (4.5)
  9. SUMA = diety + noclegi + transport + koszty_dodatkowe
  10. DO_WYPŁATY = SUMA - zaliczka

WYJŚCIE:
  - szczegółowe rozbicie per składnik
  - suma
  - kwota do wypłaty / zwrotu
```

## 6. Przepisy — Faza 2 (delegacje zagraniczne, wytyczne)

### 6.1. Dieta zagraniczna
- Stawka zależy od kraju docelowego (załącznik do rozporządzenia)
- Podróż ≤ 1 doby:
  - ≤ 8h → 1/3 diety
  - 8–12h → 1/2 diety
  - > 12h → 100% diety
- Podróż > 1 doby:
  - Każda pełna doba → 100%
  - Niepełna rozpoczęta:
    - ≤ 8h → 1/3 diety
    - > 8h → 1/2 diety

### 6.2. Pomniejszenie diety zagranicznej za posiłki
- Śniadanie: **15%** diety
- Obiad: **30%** diety
- Kolacja: **30%** diety

### 6.3. Nocleg zagraniczny
- Zwrot wg rachunku do limitu noclegowego danego kraju
- Ryczałt (bez rachunku): **25%** limitu noclegowego danego kraju

### 6.4. Czas podróży zagranicznej
- Transport lądowy: od momentu przekroczenia granicy PL
- Transport lotniczy: od startu samolotu w PL do lądowania w PL
- Czas od wyjazdu z firmy do granicy → delegacja krajowa

### 6.5. Słownik diet zagranicznych
- Wymagane pola: kraj, waluta, dieta/dobę, limit noclegowy
- Dane: pełna lista z załącznika do rozporządzenia
- Admin może edytować/dodawać/aktualizować

## 7. Generowanie PDF

### Wymagania:
- PDF musi zawierać pełne rozliczenie delegacji
- Zgodny z typowym formularzem "Rozliczenie kosztów podróży służbowej"
- Zawiera:
  - Dane osoby delegowanej (imię, nazwisko, stanowisko)
  - Dane spółki
  - Cel i miejsce delegacji
  - Data i godzina wyjazdu / powrotu
  - Środek transportu
  - Rozliczenie diet (z ewentualnymi pomniejszeniami)
  - Rozliczenie noclegów
  - Rozliczenie przejazdów / kilometrówki
  - Koszty dodatkowe
  - Podsumowanie: suma, zaliczka, do wypłaty
  - Miejsce na podpis delegowanego
  - Miejsce na podpis zatwierdzającego (np. inny członek zarządu)
- Generowany server-side (Python reportlab lub Node.js pdfkit/jspdf)
- PDF MUSI BYĆ do pobrania, wydruku i podpisania ręcznego/elektronicznego

### Przechowywanie:
- Dane delegacji przechowywane w DB do momentu kliknięcia "Rozliczone"
- Po "Rozliczone" — podpisany PDF przechowywany poza aplikacją (DMS, chmura itp.)
- Dane w DB mogą zostać usunięte po rozliczeniu (decyzja administratora, nie automatyczna)

## 8. Panel administracyjny

### Funkcjonalności:
1. **Zarządzanie stawkami** (CRUD):
   - Dieta krajowa (kwota, data obowiązywania od-do)
   - Stawki kilometrówki (per typ pojazdu, data obowiązywania)
   - Ryczałty (nocleg, dojazdy) — wyliczane automatycznie z diety lub nadpisywane
   - Limit noclegu wg rachunku

2. **Słownik diet zagranicznych** (Faza 2):
   - Import z CSV/JSON
   - CRUD per kraj: nazwa, waluta, dieta, limit noclegowy
   - Wersjonowanie (historia zmian stawek)

3. **Zarządzanie użytkownikami**:
   - Dodawanie/edycja/dezaktywacja
   - Przypisanie roli (admin / delegowany)
   - Dane osobowe: imię, nazwisko, stanowisko, pojazd domyślny

4. **Dane firmy**:
   - Nazwa spółki, NIP, adres — do nagłówka PDF

5. **Podgląd wszystkich delegacji**:
   - Lista z filtrami (osoba, data, status)
   - Statusy: Szkic → Złożona → Rozliczona
   - Możliwość oznaczenia jako "Rozliczona"

## 9. Interfejs użytkownika (delegowany)

### Ekrany:
1. **Dashboard** — lista moich delegacji (z filtrami statusu)
2. **Nowa delegacja** — wizard / formularz krokowy:
   - Krok 1: Dane podstawowe (cel, miejsce, daty/godziny)
   - Krok 2: Transport (typ, pojazd, km, bilety)
   - Krok 3: Noclegi (typ, rachunki, liczba)
   - Krok 4: Posiłki zapewnione (per doba: checkboxy śniadanie/obiad/kolacja)
   - Krok 5: Koszty dodatkowe (dynamiczna lista: typ + kwota + opis)
   - Krok 6: Zaliczka
   - Krok 7: Podsumowanie (podgląd obliczeń, generuj PDF)
3. **Podgląd/Edycja delegacji** — dane + obliczenia + PDF
4. **Profil** — moje dane, domyślny pojazd

## 10. Wymagania niefunkcjonalne

- **Responsywny** (desktop-first, ale działający na tablecie/telefonie)
- **Nie PWA** — standardowa aplikacja webowa
- **Autentykacja**: prosta (email + hasło), możliwość rozbudowy o SSO
- **Walidacja**: front-end + back-end
- **Bezpieczeństwo**: dane osobowe, RODO-compliant
- **Baza danych**: PostgreSQL
- **Język**: polski (UI), kod i komentarze — angielski
