import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableFooter,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  formatCurrency,
  formatCurrencyByCode,
  formatDateTime,
} from '@/utils/formatters';
import { createDelegation, updateDelegation, calculateDelegation } from '@/api/delegations';
import {
  normalizeCalculationResult,
  type ApiCalculationResult,
} from '@/utils/calculation';
import { toast } from 'sonner';
import type { DelegationFormValues } from './DelegationWizard';

function parseDecimal(value: string | number, fieldName: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const normalized = String(value).trim().replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Nieprawidlowa wartosc pola: ${fieldName}`);
  }
  return parsed;
}

function parseOptionalDecimal(
  value: string | number | null | undefined,
  fieldName: string
): number | null {
  if (value == null || value === '') return null;
  return parseDecimal(value, fieldName);
}

function resolveApiAccommodationType(data: DelegationFormValues): 'RECEIPT' | 'LUMP_SUM' | 'FREE' | 'NONE' {
  if (data.accommodationType !== 'MIXED') {
    return data.accommodationType;
  }

  const nonEmptyTypes = data.days
    .map((d) => d.accommodationType)
    .filter((type) => type !== 'NONE');

  if (nonEmptyTypes.length === 0) {
    return 'NONE';
  }

  const firstType = nonEmptyTypes[0];
  const isSingleType = nonEmptyTypes.every((type) => type === firstType);
  return isSingleType ? firstType : 'NONE';
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatHoursOrMinutes(hours: number): string {
  const safeHours = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  const totalMinutes = Math.round(safeHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function formatDurationSummary(fullDays: number, remainingHours: number): string {
  const parts: string[] = [];

  if (fullDays > 0) {
    const dayLabel = fullDays === 1 ? 'doba' : fullDays < 5 ? 'doby' : 'dob';
    parts.push(`${fullDays} ${dayLabel}`);
  }

  if (remainingHours > 0) {
    parts.push(formatHoursOrMinutes(remainingHours));
  }

  return parts.length > 0 ? parts.join(', ') : '0 min';
}

const TRANSPORT_LABELS: Record<string, string> = {
  COMPANY_VEHICLE: 'Pojazd sluzbowy',
  PUBLIC_TRANSPORT: 'Transport publiczny',
  PRIVATE_VEHICLE: 'Pojazd prywatny (km)',
  MIXED: 'Mieszany',
};

const ACCOMMODATION_LABELS: Record<string, string> = {
  RECEIPT: 'Wg rachunku',
  LUMP_SUM: 'Ryczalt',
  FREE: 'Bezplatny',
  NONE: 'Brak',
};

interface StepSummaryProps {
  delegationId?: string;
  ensureDelegationId?: (data: DelegationFormValues) => Promise<string>;
  calculationResult: ApiCalculationResult | null;
  onCalculationResult: (result: ApiCalculationResult | null) => void;
}

export function StepSummary({
  delegationId,
  ensureDelegationId,
  calculationResult,
  onCalculationResult,
}: StepSummaryProps) {
  const { getValues } = useFormContext<DelegationFormValues>();
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  const formData = getValues();

  // Auto-calculate on mount or when form data changes
  useEffect(() => {
    performCalculation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const performCalculation = async () => {
    setIsCalculating(true);
    setCalcError(null);

    try {
      let id = delegationId;
      const payload = buildApiPayload(formData);

      // Ensure a draft id exists. In new delegation flow this callback deduplicates create calls.
      if (!id) {
        if (ensureDelegationId) {
          id = await ensureDelegationId(formData);
        } else {
          const created = await createDelegation(payload);
          id = created.delegation?.id ?? created.id;
        }
      }

      if (!id) {
        throw new Error('Nie udalo sie utworzyc delegacji do obliczen.');
      }

      // Keep DB in sync with current wizard values before calculation.
      await updateDelegation(id, payload);

      const result = await calculateDelegation(id);
      onCalculationResult(result);
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        err.message ||
        'Blad podczas obliczania delegacji.';
      setCalcError(message);
      toast.error('Blad obliczen', { description: message });
    } finally {
      setIsCalculating(false);
    }
  };

  // Loading state
  if (isCalculating) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">
          Obliczanie kosztow delegacji...
        </p>
      </div>
    );
  }

  // Error state
  if (calcError && !calculationResult) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-medium">Blad obliczen</p>
            <p>{calcError}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={performCalculation}
        >
          <Calculator className="mr-1 h-4 w-4" />
          Oblicz ponownie
        </Button>
      </div>
    );
  }

  const calc = normalizeCalculationResult(calculationResult);
  const foreignCurrency = calc?.diet.foreignCurrency ?? null;
  const formatDietAmount = (value: string | number, isForeign: boolean) => {
    if (isForeign && foreignCurrency) {
      return formatCurrencyByCode(value, foreignCurrency);
    }
    return formatCurrency(value);
  };
  const resolveNightCurrency = (night: any): string => {
    const fromNight = String(night?.currency ?? '').trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(fromNight)) return fromNight;
    if (!!night?.isForeign && foreignCurrency) return foreignCurrency;
    return 'PLN';
  };
  const formatAccommodationAmount = (night: any): string => {
    const currency = resolveNightCurrency(night);
    const cappedAmount = toNumber(night?.amount);
    const cappedLabel = formatCurrencyByCode(cappedAmount, currency);
    const originalRaw = night?.originalAmount;
    if (originalRaw == null) {
      return cappedLabel;
    }

    const originalAmount = toNumber(originalRaw);
    if (!night?.overLimit || originalAmount <= cappedAmount) {
      return cappedLabel;
    }

    return `${cappedLabel} (z kwoty ${formatCurrencyByCode(originalAmount, currency)})`;
  };

  // No result yet
  if (!calc) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Calculator className="h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          Kliknij przycisk ponizej, aby obliczyc koszty delegacji.
        </p>
        <Button
          type="button"
          className="mt-4"
          onClick={performCalculation}
        >
          <Calculator className="mr-1 h-4 w-4" />
          Oblicz
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Podsumowanie delegacji</h2>
        <p className="text-sm text-muted-foreground">
          Sprawdz obliczone koszty przed zapisaniem lub zlozeniem delegacji.
        </p>
      </div>

      {/* Basic info summary */}
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <span className="text-muted-foreground">Cel: </span>
          <span className="font-medium">{formData.purpose}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Miejsce: </span>
          <span className="font-medium">{formData.destination}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Wyjazd: </span>
          <span className="font-medium">
            {formData.departureAt
              ? formatDateTime(new Date(formData.departureAt).toISOString())
              : '---'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Powrot: </span>
          <span className="font-medium">
            {formData.returnAt
              ? formatDateTime(new Date(formData.returnAt).toISOString())
              : '---'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Czas trwania: </span>
          <span className="font-medium">
            {formatDurationSummary(
              toNumber(calc.duration.fullDays),
              toNumber(calc.duration.remainingHours)
            )}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Transport: </span>
          <span className="font-medium">
            {TRANSPORT_LABELS[formData.transportType] ??
              formData.transportType}
          </span>
        </div>
      </div>

      <Separator />

      {/* Diet breakdown */}
      <div className="space-y-3">
        <h3 className="font-semibold">Diety</h3>
        <p className="text-xs text-muted-foreground">
          Stawka diety:{' '}
          {calc.diet.rateUsed != null
            ? formatCurrency(calc.diet.rateUsed)
            : calc.isForeign
            ? `wg stawki krajowej (PLN) i zagranicznej (${foreignCurrency ?? 'waluta kraju'})`
            : 'wg stawki krajowej'}
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doba</TableHead>
                <TableHead className="text-right">Czas</TableHead>
                <TableHead className="text-right">Podstawa</TableHead>
                <TableHead className="text-right">Pomniejszenie</TableHead>
                <TableHead className="text-right">Dieta</TableHead>
              </TableRow>
            </TableHeader>
              <TableBody>
                {calc.diet.days.map((day) => {
                  const isForeignDay = !!day.isForeign;
                  return (
                    <TableRow key={day.dayNumber}>
                      <TableCell>{day.dayNumber}</TableCell>
                      <TableCell className="text-right">
                        {formatHoursOrMinutes(toNumber(day.hours))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatDietAmount(day.baseAmount, isForeignDay)}
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(String(day.deductions.total)) > 0 ? (
                          <span className="text-destructive">
                            -{formatDietAmount(day.deductions.total, isForeignDay)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">---</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatDietAmount(day.finalAmount, isForeignDay)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-semibold">
                  Suma diet
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {calc.isForeign ? (
                    <span>
                      {formatCurrency(calc.diet.domesticTotal ?? 0)} +{' '}
                      {formatCurrencyByCode(
                        calc.diet.foreignTotal ?? 0,
                        foreignCurrency ?? 'PLN'
                      )}
                    </span>
                  ) : (
                    formatCurrency(calc.diet.total)
                  )}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>

      <Separator />

      {/* Accommodation */}
      <div className="space-y-3">
        <h3 className="font-semibold">Noclegi</h3>
        {calc.accommodation.nights.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Noc</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Nr dokumentu</TableHead>
                  <TableHead className="text-right">Kwota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calc.accommodation.nights.map((night, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ACCOMMODATION_LABELS[night.type] ?? night.type}
                      </Badge>
                      {night.overLimit && (
                        <Badge variant="destructive" className="ml-2">
                          Ponad limit
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{night.receiptNumber || '---'}</TableCell>
                    <TableCell className="text-right">
                      {formatAccommodationAmount(night)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-semibold">
                    Suma noclegow
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {calc.isForeign ? (
                      (() => {
                        const foreignCode = (foreignCurrency ?? '').toUpperCase();
                        const plnTotal = calc.accommodation.nights
                          .filter((n) => resolveNightCurrency(n) === 'PLN')
                          .reduce((sum, n) => sum + toNumber(n.amount), 0);
                        const foreignTotal = foreignCode
                          ? calc.accommodation.nights
                              .filter((n) => resolveNightCurrency(n) === foreignCode)
                              .reduce((sum, n) => sum + toNumber(n.amount), 0)
                          : 0;

                        if (foreignTotal > 0 && plnTotal > 0) {
                          return (
                            <span>
                              {formatCurrency(plnTotal)} +{' '}
                              {formatCurrencyByCode(foreignTotal, foreignCode)}
                            </span>
                          );
                        }
                        if (foreignTotal > 0) {
                          return formatCurrencyByCode(foreignTotal, foreignCode);
                        }
                        return formatCurrency(plnTotal);
                      })()
                    ) : (
                      formatCurrency(calc.accommodation.total)
                    )}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Brak noclegow.</p>
        )}
      </div>

      <Separator />

      {/* Transport */}
      <div className="space-y-3">
        <h3 className="font-semibold">Transport</h3>

        {calc.transport.mileage && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p>
              Kilometrowka: {calc.transport.mileage.distanceKm} km x{' '}
              {formatCurrency(calc.transport.mileage.ratePerKm)}/km ={' '}
              <span className="font-semibold">
                {formatCurrency(calc.transport.mileage.total)}
              </span>
            </p>
          </div>
        )}

        {calc.transport.receipts.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opis</TableHead>
                  <TableHead>Nr dokumentu</TableHead>
                  <TableHead className="text-right">Kwota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calc.transport.receipts.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{r.description}</TableCell>
                    <TableCell>{r.receiptNumber || '---'}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(r.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="text-sm">
          <span className="text-muted-foreground">Transport razem: </span>
          <span className="font-semibold">
            {formatCurrency(calc.transport.total)}
          </span>
        </div>
      </div>

      <Separator />

      {/* Additional costs */}
      <div className="space-y-3">
        <h3 className="font-semibold">Koszty dodatkowe</h3>
        {calc.additionalCosts.items.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opis</TableHead>
                  <TableHead>Nr dokumentu</TableHead>
                  <TableHead className="text-right">Kwota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calc.additionalCosts.items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.receiptNumber || '---'}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">
                    Suma kosztow dodatkowych
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(calc.additionalCosts.total)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Brak kosztow dodatkowych.
          </p>
        )}
      </div>

      <Separator />

      {/* Grand total */}
      <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Diety</span>
            <span>{formatCurrency(calc.summary.dietTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Noclegi</span>
            <span>{formatCurrency(calc.summary.accommodationTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Transport</span>
            <span>{formatCurrency(calc.summary.transportTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Koszty dodatkowe</span>
            <span>{formatCurrency(calc.summary.additionalTotal)}</span>
          </div>

          <Separator />

          <div className="flex justify-between font-semibold">
            <span>Suma calkowita</span>
            <span>{formatCurrency(calc.summary.grandTotal)}</span>
          </div>

          <div className="flex justify-between text-muted-foreground">
            <span>Zaliczka</span>
            <span>-{formatCurrency(calc.summary.advanceAmount)}</span>
          </div>

          <Separator />

          <div className="flex justify-between text-lg font-bold">
            <span>
              {parseFloat(String(calc.summary.amountDue)) >= 0
                ? 'Do wyplaty'
                : 'Do zwrotu'}
            </span>
            <span
              className={
                parseFloat(String(calc.summary.amountDue)) < 0
                  ? 'text-destructive'
                  : 'text-primary'
              }
            >
              {formatCurrency(
                Math.abs(parseFloat(String(calc.summary.amountDue)))
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Recalculate button */}
      <div className="flex justify-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={performCalculation}
        >
          <Calculator className="mr-1 h-4 w-4" />
          Przelicz ponownie
        </Button>
      </div>
    </div>
  );
}

// ---------- Helpers ----------

function buildApiPayload(data: DelegationFormValues) {
  const proposedNumber = data.proposedNumber?.trim();

  return {
    type: data.type ?? 'DOMESTIC',
    proposedNumber: proposedNumber ? proposedNumber : null,
    purpose: data.purpose,
    destination: data.destination,
    departureAt: new Date(data.departureAt).toISOString(),
    returnAt: new Date(data.returnAt).toISOString(),
    foreignCountry: data.foreignCountry ?? null,
    borderCrossingOut: data.borderCrossingOut
      ? new Date(data.borderCrossingOut).toISOString()
      : null,
    borderCrossingIn: data.borderCrossingIn
      ? new Date(data.borderCrossingIn).toISOString()
      : null,
    transportType: data.transportType,
    vehicleType: data.mileageDetails?.vehicleType ?? null,
    accommodationType: resolveApiAccommodationType(data),
    advanceAmount: parseDecimal(data.advanceAmount || '0', 'advanceAmount'),
    days: data.days.map((d) => ({
      dayNumber: d.dayNumber,
      date: d.date,
      breakfastProvided: d.breakfastProvided,
      lunchProvided: d.lunchProvided,
      dinnerProvided: d.dinnerProvided,
      accommodationType: d.accommodationType,
      accommodationCost: parseOptionalDecimal(
        d.accommodationCost,
        `days[${d.dayNumber}].accommodationCost`
      ),
      accommodationReceiptNumber:
        d.accommodationType === 'RECEIPT'
          ? (d.accommodationReceiptNumber?.trim() || null)
          : null,
      accommodationCurrency:
        d.accommodationType === 'RECEIPT'
          ? (d.accommodationCurrency?.trim().toUpperCase() || null)
          : null,
      isForeign: d.isForeign ?? false,
    })),
    mileageDetails: data.mileageDetails
      ? {
          vehicleType: data.mileageDetails.vehicleType,
          vehiclePlate: data.mileageDetails.vehiclePlate,
          distanceKm: data.mileageDetails.distanceKm,
        }
      : null,
    transportReceipts: data.transportReceipts.map((r) => ({
      description: r.description,
      amount: parseDecimal(r.amount, 'transportReceipts.amount'),
      receiptNumber: r.receiptNumber.trim(),
    })),
    additionalCosts: data.additionalCosts.map((c) => ({
      description: c.description,
      category: c.category,
      amount: parseDecimal(c.amount, 'additionalCosts.amount'),
      receiptNumber: c.receiptNumber.trim(),
    })),
  };
}
