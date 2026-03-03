# Specyfikacja szablonu PDF — Rozliczenie delegacji

## Format
- A4 (210 × 297 mm)
- Orientacja: pionowa (portrait)
- Marginesy: 20mm ze wszystkich stron
- Font: Helvetica lub DejaVu Sans (Unicode, polskie znaki!)
- Generowanie: server-side (PDFKit w Node.js lub reportlab w Pythonie)

## Układ dokumentu

### 1. Nagłówek (góra strony)

```
[LOGO opcjonalnie]

                    ROZLICZENIE KOSZTÓW PODRÓŻY SŁUŻBOWEJ
                              Nr: DEL/2026/0001

Dane spółki:                          Dane delegowanego:
Przykładowa Sp. z o.o.                Imię i nazwisko: Jan Kowalski
NIP: 123-456-78-90                    Stanowisko: Członek Zarządu
ul. Przykładowa 1
00-001 Warszawa
```

### 2. Sekcja: Dane delegacji

```
┌────────────────────────────────────────────────────────────────────┐
│ Cel podróży:        Spotkanie z klientem XYZ                      │
│ Miejsce:            Kraków                                         │
│ Data wyjazdu:       10.03.2026, godz. 07:00                       │
│ Data powrotu:       12.03.2026, godz. 18:00                       │
│ Czas trwania:       2 doby i 11 godzin                            │
│ Środek transportu:  Samochód prywatny (WA 12345, > 900 cm³)       │
└────────────────────────────────────────────────────────────────────┘
```

### 3. Sekcja: Rozliczenie diet

Tabela:
```
┌─────┬──────────┬────────┬────────────────┬──────────────┬──────────┐
│ Nr  │  Data    │ Godzin │ Dieta naliczona│ Pomniejszenia│  Dieta   │
│     │          │        │                │              │  netto   │
├─────┼──────────┼────────┼────────────────┼──────────────┼──────────┤
│  1  │10.03.2026│  24,0  │     45,00 zł   │     0,00 zł  │ 45,00 zł │
│  2  │11.03.2026│  24,0  │     45,00 zł   │     0,00 zł  │ 45,00 zł │
│  3  │12.03.2026│  11,0  │     22,50 zł   │   -11,25 zł  │ 11,25 zł │
│     │          │        │                │  (śniadanie) │          │
├─────┴──────────┴────────┼────────────────┼──────────────┼──────────┤
│                  RAZEM  │    112,50 zł   │   -11,25 zł  │101,25 zł │
└─────────────────────────┴────────────────┴──────────────┴──────────┘

Stawka diety: 45,00 zł/dobę (obowiązująca od 01.01.2023)
```

### 4. Sekcja: Noclegi

```
┌─────┬──────────┬──────────────────────┬──────────────┐
│ Nr  │  Data    │ Rodzaj               │    Kwota     │
├─────┼──────────┼──────────────────────┼──────────────┤
│  1  │10.03.2026│ Wg rachunku (hotel)  │   350,00 zł  │
│  2  │11.03.2026│ Wg rachunku (hotel)  │   350,00 zł  │
├─────┴──────────┼──────────────────────┼──────────────┤
│         RAZEM  │                      │   700,00 zł  │
└────────────────┴──────────────────────┴──────────────┘
```

### 5. Sekcja: Transport / Kilometrówka

Wariant A — Kilometrówka:
```
Pojazd: Samochód osobowy > 900 cm³, nr rej. WA 12345
Trasa: Warszawa – Kraków – Warszawa
Dystans: 620 km
Stawka: 1,15 zł/km (obowiązująca od 17.01.2023)
                                        RAZEM: 713,00 zł
```

Wariant B — Bilety:
```
┌─────┬───────────────────────────────────┬──────────────┐
│ Nr  │ Opis                              │    Kwota     │
├─────┼───────────────────────────────────┼──────────────┤
│  1  │ Bilet PKP IC Warszawa→Kraków      │    89,00 zł  │
│  2  │ Bilet PKP IC Kraków→Warszawa      │    89,00 zł  │
├─────┴───────────────────────────────────┼──────────────┤
│                                  RAZEM  │   178,00 zł  │
└─────────────────────────────────────────┴──────────────┘
```

### 6. Sekcja: Ryczałt za dojazdy (opcjonalnie)
```
Ryczałt za dojazdy: 2 doby × 9,00 zł = 18,00 zł
```

### 7. Sekcja: Koszty dodatkowe

```
┌─────┬───────────────────────────────────┬──────────────┐
│ Nr  │ Opis                              │    Kwota     │
├─────┼───────────────────────────────────┼──────────────┤
│  1  │ Opłata za autostradę A4           │    52,00 zł  │
│  2  │ Parking Kraków centrum            │    35,00 zł  │
├─────┴───────────────────────────────────┼──────────────┤
│                                  RAZEM  │    87,00 zł  │
└─────────────────────────────────────────┴──────────────┘
```

### 8. Sekcja: Podsumowanie

```
╔═════════════════════════════════════════════════════════╗
║  PODSUMOWANIE KOSZTÓW                                   ║
╠═════════════════════════════════════════════════════════╣
║  Diety:                                     101,25 zł  ║
║  Noclegi:                                   700,00 zł  ║
║  Transport (kilometrówka):                  713,00 zł  ║
║  Koszty dodatkowe:                           87,00 zł  ║
╠═════════════════════════════════════════════════════════╣
║  RAZEM:                                   1 601,25 zł  ║
║  Zaliczka:                                  500,00 zł  ║
╠═════════════════════════════════════════════════════════╣
║  DO WYPŁATY:                              1 101,25 zł  ║
║  (słownie: jeden tysiąc sto jeden zł 25/100)           ║
╚═════════════════════════════════════════════════════════╝
```

### 9. Sekcja: Podpisy

```
Uwagi: _______________________________________________________________

Oświadczam, że powyższe dane są zgodne ze stanem faktycznym.


_____________________________          _____________________________
Podpis osoby delegowanej              Podpis zatwierdzającego
(imię i nazwisko)                      (imię i nazwisko, stanowisko)

Data: ________________                 Data: ________________
```

### 10. Stopka

```
Dokument wygenerowany: 15.03.2026, 14:32
Podstawa prawna: Rozporządzenie MPiPS z 25.10.2022 r. (Dz.U. 2022 poz. 2302)
```

## Wymagania techniczne PDF

1. **Polskie znaki**: Font musi obsługiwać UTF-8 z pełnym zestawem polskich znaków (ą, ć, ę, ł, ń, ó, ś, ź, ż)
2. **Kwoty**: Zawsze z 2 miejscami po przecinku, separator dziesiętny: przecinek, separator tysięcy: spacja
3. **Daty**: Format DD.MM.RRRR
4. **Numeracja**: DEL/{rok}/{numer_sekwencyjny_4cyfry} — np. DEL/2026/0001
5. **Kwota słownie**: Implementacja konwersji liczby na tekst po polsku (np. biblioteka `n2words` lub custom)
6. **Rozmiar**: Jedna strona dla delegacji jednodniowej, max 2 strony dla wielodniowej

## Implementacja w Node.js (PDFKit)

Rekomendowany approach:
```
npm install pdfkit
```

- Użyj fontu DejaVu Sans (dostępny w systemie Linux, obsługuje polskie znaki)
- Lub zarejestruj font z pliku TTF
- Tabele: rysuj linie ręcznie (`doc.moveTo().lineTo().stroke()`) lub użyj `pdfkit-table`
- Generuj do Buffer, zwracaj jako response z `Content-Type: application/pdf`

## Alternatywa: Puppeteer + HTML template

Jeśli PDFKit okaże się zbyt trudny do formatowania tabel:
1. Stwórz HTML template (Handlebars/EJS)
2. Renderuj w Puppeteer headless Chrome
3. `page.pdf()` → generuje PDF

Plusy: łatwiejsze stylowanie CSS, responsywne tabele
Minusy: cięższy runtime (Chromium), wolniejszy
