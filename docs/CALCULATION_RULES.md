# Reguły obliczania delegacji — implementacja

## 1. Algorytm obliczania diet — delegacja krajowa

### 1.1. Wyznaczenie dób delegacyjnych

Doba delegacyjna NIE jest dobą kalendarzową. Liczy się od godziny wyjazdu.

```
Przykład:
  Wyjazd: 10.03.2026 godz. 7:00
  Powrót: 12.03.2026 godz. 18:00

  Doba 1: 10.03 7:00 → 11.03 7:00 (24h) — pełna doba
  Doba 2: 11.03 7:00 → 12.03 7:00 (24h) — pełna doba
  Doba 3: 12.03 7:00 → 12.03 18:00 (11h) — niepełna doba

  Wynik: 2 pełne doby + 11 godzin
```

### 1.2. Algorytm w pseudokodzie

```typescript
function calculateDomesticDiet(
  departureAt: DateTime,
  returnAt: DateTime,
  days: DelegationDay[],
  rate: DomesticRate
): DietCalculation {
  const totalMinutes = diffInMinutes(returnAt, departureAt);
  const totalHours = totalMinutes / 60;
  
  // Podróż jednodniowa (≤ 24h)
  if (totalHours <= 24) {
    return calculateSingleDayDiet(totalHours, days[0], rate);
  }
  
  // Podróż wielodniowa (> 24h)
  const fullDays = Math.floor(totalHours / 24);
  const remainingHours = totalHours - (fullDays * 24);
  
  let result = [];
  
  // Pełne doby — 100% diety
  for (let i = 0; i < fullDays; i++) {
    const day = days[i];
    const base = rate.dailyDiet; // 45.00
    const deductions = calculateDeductions(day, rate);
    const final = Math.max(0, base - deductions);
    result.push({ dayNumber: i + 1, base, deductions, final });
  }
  
  // Niepełna doba na końcu
  if (remainingHours > 0) {
    const lastDay = days[fullDays];
    let base: number;
    if (remainingHours <= 8) {
      base = rate.dailyDiet * 0.5; // 50% = 22.50
    } else {
      base = rate.dailyDiet; // 100% = 45.00
    }
    const deductions = calculateDeductions(lastDay, rate);
    const final = Math.max(0, base - deductions);
    result.push({ dayNumber: fullDays + 1, base, deductions, final });
  }
  
  return result;
}

function calculateSingleDayDiet(
  totalHours: number,
  day: DelegationDay,
  rate: DomesticRate
): DietCalculation {
  let base: number;
  
  if (totalHours < 8) {
    base = 0; // Dieta nie przysługuje
  } else if (totalHours <= 12) {
    base = rate.dailyDiet * 0.5; // 50% = 22.50
  } else {
    base = rate.dailyDiet; // 100% = 45.00
  }
  
  if (base === 0) return { base: 0, deductions: 0, final: 0 };
  
  const deductions = calculateDeductions(day, rate);
  const final = Math.max(0, base - deductions);
  
  return { base, deductions, final };
}
```

### 1.3. Pomniejszenie diety za posiłki

**KLUCZOWA ZASADA**: Pomniejszenie liczy się ZAWSZE od PEŁNEJ diety, niezależnie od przysługującego ułamka.

```typescript
function calculateDeductions(
  day: DelegationDay,
  rate: DomesticRate
): number {
  let deductions = 0;
  const fullDiet = rate.dailyDiet; // 45.00 — ZAWSZE pełna dieta jako podstawa
  
  if (day.breakfastProvided) {
    deductions += fullDiet * (rate.breakfastDeductionPct / 100); // 25% z 45 = 11.25
  }
  if (day.lunchProvided) {
    deductions += fullDiet * (rate.lunchDeductionPct / 100); // 50% z 45 = 22.50
  }
  if (day.dinnerProvided) {
    deductions += fullDiet * (rate.dinnerDeductionPct / 100); // 25% z 45 = 11.25
  }
  
  return deductions;
}
```

### 1.4. Przykłady testowe

#### Przykład A: Delegacja jednodniowa, 10h, bez posiłków
```
Wyjazd: 7:00, Powrót: 17:00 (10h)
Posiłki: brak
→ 8–12h = 50% diety = 22.50 zł
→ Pomniejszenia: 0
→ DIETA = 22.50 zł
```

#### Przykład B: Delegacja jednodniowa, 10h, z obiadem
```
Wyjazd: 7:00, Powrót: 17:00 (10h)
Posiłki: obiad zapewniony
→ 8–12h = 50% diety = 22.50 zł
→ Pomniejszenie za obiad: 50% × 45.00 = 22.50 zł
→ DIETA = max(0, 22.50 - 22.50) = 0.00 zł
```

#### Przykład C: Delegacja 4 dni + 3h
```
Wyjazd: 10.03 7:00, Powrót: 14.03 10:00
Doba 1-4: pełne (4 × 45 = 180)
Doba 5: 3h (≤8h → 50% = 22.50)
Dzień 3: śniadanie zapewnione → pomniejszenie 11.25

Diety:
  Doba 1: 45.00 - 0 = 45.00
  Doba 2: 45.00 - 0 = 45.00
  Doba 3: 45.00 - 11.25 = 33.75
  Doba 4: 45.00 - 0 = 45.00
  Doba 5: 22.50 - 0 = 22.50
RAZEM: 191.25 zł
```

#### Przykład D: Krótka delegacja < 8h
```
Wyjazd: 9:00, Powrót: 14:00 (5h)
→ < 8h → DIETA = 0 zł
```

## 2. Obliczanie noclegów

```typescript
function calculateAccommodation(
  days: DelegationDay[],
  rate: DomesticRate
): AccommodationCalculation {
  let total = 0;
  const nights = [];
  
  for (const day of days) {
    switch (day.accommodationType) {
      case 'RECEIPT':
        // Zwrot wg rachunku, max 20× dieta
        const maxReceipt = rate.accommodationMaxReceipt; // 900.00
        const amount = Math.min(day.accommodationCost, maxReceipt);
        // UWAGA: przekroczenie limitu wymaga zgody admina — flagowane
        nights.push({ type: 'RECEIPT', amount, overLimit: day.accommodationCost > maxReceipt });
        total += amount;
        break;
      
      case 'LUMP_SUM':
        // Ryczałt 150% diety = 67.50
        const lumpSum = rate.accommodationLumpSum;
        nights.push({ type: 'LUMP_SUM', amount: lumpSum });
        total += lumpSum;
        break;
      
      case 'FREE':
      case 'NONE':
        nights.push({ type: day.accommodationType, amount: 0 });
        break;
    }
  }
  
  return { nights, total };
}
```

## 3. Obliczanie transportu

```typescript
function calculateTransport(
  delegation: Delegation,
  mileageRate: MileageRate,
  domesticRate: DomesticRate
): TransportCalculation {
  let total = 0;
  
  switch (delegation.transportType) {
    case 'PRIVATE_VEHICLE':
      // Kilometrówka
      const mileageTotal = delegation.mileageDetails.distanceKm * mileageRate.ratePerKm;
      total += mileageTotal;
      break;
    
    case 'PUBLIC_TRANSPORT':
      // Suma biletów
      total += delegation.transportReceipts.reduce((sum, r) => sum + r.amount, 0);
      break;
    
    case 'COMPANY_VEHICLE':
      // Brak zwrotu za transport
      total = 0;
      break;
    
    case 'MIXED':
      // Kilometrówka + bilety
      if (delegation.mileageDetails) {
        total += delegation.mileageDetails.distanceKm * mileageRate.ratePerKm;
      }
      total += delegation.transportReceipts.reduce((sum, r) => sum + r.amount, 0);
      break;
  }
  
  // Ryczałt za dojazdy komunikacją miejską (opcjonalnie, per doba)
  // Tylko jeśli delegowany korzystał z komunikacji miejskiej w miejscu delegacji
  // i NIE jeździł pojazdem prywatnym/służbowym
  
  return { total };
}
```

## 4. Lookup stawek

Stawki są pobierane na podstawie daty wyjazdu delegacji:

```typescript
function findApplicableRate(departureAt: Date): DomesticRate {
  return prisma.domesticRate.findFirst({
    where: {
      validFrom: { lte: departureAt },
      OR: [
        { validTo: null },
        { validTo: { gte: departureAt } }
      ]
    },
    orderBy: { validFrom: 'desc' }
  });
}

function findApplicableMileageRate(vehicleType: VehicleType, departureAt: Date): MileageRate {
  return prisma.mileageRate.findFirst({
    where: {
      vehicleType,
      validFrom: { lte: departureAt },
      OR: [
        { validTo: null },
        { validTo: { gte: departureAt } }
      ]
    },
    orderBy: { validFrom: 'desc' }
  });
}
```

## 5. Podsumowanie końcowe

```typescript
function calculateSummary(
  diet: DietCalculation,
  accommodation: AccommodationCalculation,
  transport: TransportCalculation,
  additionalCosts: AdditionalCost[],
  advanceAmount: number
): Summary {
  const additionalTotal = additionalCosts.reduce((sum, c) => sum + c.amount, 0);
  const grandTotal = diet.total + accommodation.total + transport.total + additionalTotal;
  const amountDue = grandTotal - advanceAmount;
  
  return {
    dietTotal: diet.total,
    accommodationTotal: accommodation.total,
    transportTotal: transport.total,
    additionalTotal,
    grandTotal,
    advanceAmount,
    amountDue // Może być ujemne → delegowany zwraca nadwyżkę zaliczki
  };
}
```

## 6. Walidacje biznesowe

Przed obliczeniem sprawdzić:
1. `returnAt > departureAt` — data powrotu po wyjeździe
2. `departureAt` nie z przyszłości (chyba że szkic)
3. Liczba `days` zgadza się z obliczonym czasem trwania
4. Jeśli `transportType = PRIVATE_VEHICLE` → wymagane `mileageDetails`
5. Jeśli `accommodationType = RECEIPT` → wymagana `accommodationCost > 0`
6. Wszystkie kwoty ≥ 0
7. `distanceKm > 0` przy kilometrówce

## 7. Faza 2 — różnice w obliczaniu diet zagranicznych

Kluczowe różnice:
- Progi godzinowe inne: ≤8h → 1/3, 8–12h → 1/2, >12h → 100%
- Pomniejszenie za posiłki: śniadanie 15%, obiad 30%, kolacja 30%
- Stawka diety i limit noclegowy zależą od kraju
- Czas liczy się od granicy (nie od wyjazdu z firmy)
- Odcinek krajowy (do granicy) rozliczany wg stawek krajowych
