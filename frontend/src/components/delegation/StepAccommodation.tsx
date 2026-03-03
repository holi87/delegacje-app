import { useEffect, useMemo } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/utils/formatters';
import { BedDouble, AlertTriangle } from 'lucide-react';
import type { DelegationFormValues } from './DelegationWizard';
import type { AccommodationType } from '../../../../shared/types';

const ACCOMMODATION_TYPES = [
  { value: 'RECEIPT', label: 'Wg rachunku' },
  { value: 'LUMP_SUM', label: 'Ryczalt' },
  { value: 'FREE', label: 'Zapewniony bezplatnie' },
  { value: 'NONE', label: 'Brak' },
] as const;

const LUMP_SUM_AMOUNT = 67.5; // 150% of 45 zl diet
const MAX_RECEIPT_AMOUNT = 900; // 20x diet

/**
 * Calculate nights from departure/return based on delegation days (doba delegacyjna).
 * A night is between consecutive delegation days.
 * Returns array of date strings (YYYY-MM-DD) for each night.
 */
function calculateNights(departureAt: string, returnAt: string): string[] {
  if (!departureAt || !returnAt) return [];

  const dep = new Date(departureAt);
  const ret = new Date(returnAt);

  if (isNaN(dep.getTime()) || isNaN(ret.getTime())) return [];
  if (ret <= dep) return [];

  const diffMs = ret.getTime() - dep.getTime();
  const totalHours = diffMs / (1000 * 60 * 60);

  // Number of nights = number of full 24h periods (at least one night if > 12h trip)
  // More precisely: nights correspond to calendar nights spent away
  const nights: string[] = [];

  // Start from departure date, iterate calendar nights
  const depDate = new Date(dep);
  depDate.setHours(0, 0, 0, 0);

  const retDate = new Date(ret);
  retDate.setHours(0, 0, 0, 0);

  // If departure and return are on the same calendar day, no nights
  if (depDate.getTime() === retDate.getTime()) return [];

  // Iterate from departure date to the day before return date
  const current = new Date(depDate);
  while (current < retDate) {
    const nightStr = current.toISOString().slice(0, 10);
    nights.push(nightStr);
    current.setDate(current.getDate() + 1);
  }

  return nights;
}

function formatNightDate(dateStr: string): string {
  const date = new Date(dateStr);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;

  return `${fmt(date)} / ${fmt(nextDay)}`;
}

export function StepAccommodation() {
  const { watch, setValue, control, register, formState: { errors } } =
    useFormContext<DelegationFormValues>();

  const departureAt = watch('departureAt');
  const returnAt = watch('returnAt');
  const accommodationType = watch('accommodationType');
  const days = watch('days');

  const nights = useMemo(
    () => calculateNights(departureAt, returnAt),
    [departureAt, returnAt]
  );

  // Sync accommodation type to days when global type changes or nights change
  useEffect(() => {
    if (nights.length === 0) return;

    const currentDays = days || [];
    const updatedDays = [...currentDays];

    // Ensure we have entries for all nights in days array (for accommodation tracking)
    nights.forEach((nightDate, idx) => {
      const dayIndex = idx; // Accommodation night i maps to day i
      if (dayIndex < updatedDays.length) {
        // Update existing day's accommodation type
        updatedDays[dayIndex] = {
          ...updatedDays[dayIndex],
          accommodationType: accommodationType as AccommodationType,
          accommodationCost:
            accommodationType === 'RECEIPT'
              ? updatedDays[dayIndex]?.accommodationCost ?? ''
              : null,
        };
      }
    });

    // Only update if days actually changed
    if (JSON.stringify(updatedDays) !== JSON.stringify(currentDays)) {
      setValue('days', updatedDays);
    }
  }, [accommodationType, nights.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAccommodationTypeChange = (value: string) => {
    setValue('accommodationType', value as AccommodationType);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Noclegi</h2>
        <p className="text-sm text-muted-foreground">
          Okresl typ noclegu i podaj koszty.
        </p>
      </div>

      {/* Global accommodation type */}
      <div className="space-y-2">
        <Label>Typ noclegu *</Label>
        <Controller
          control={control}
          name="accommodationType"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(val) => {
                field.onChange(val);
                handleAccommodationTypeChange(val);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz typ noclegu" />
              </SelectTrigger>
              <SelectContent>
                {ACCOMMODATION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Nights list */}
      {nights.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <BedDouble className="h-5 w-5" />
          <span>
            Brak noclegow — delegacja jednodniowa lub daty nie zostaly
            uzupelnione.
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Noclegi ({nights.length})
          </h3>

          {nights.map((nightDate, idx) => (
            <div
              key={nightDate}
              className="flex items-center gap-4 rounded-lg border p-3"
            >
              <div className="flex items-center gap-2">
                <BedDouble className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Noc {idx + 1}: {formatNightDate(nightDate)}
                </span>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {accommodationType === 'RECEIPT' && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="0.00"
                      className="w-32"
                      {...register(`days.${idx}.accommodationCost`)}
                    />
                    <span className="text-xs text-muted-foreground">PLN</span>
                    {days[idx]?.accommodationCost &&
                      parseFloat(days[idx].accommodationCost || '0') >
                        MAX_RECEIPT_AMOUNT && (
                        <div className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Ponad limit {formatCurrency(MAX_RECEIPT_AMOUNT)}</span>
                        </div>
                      )}
                  </div>
                )}

                {accommodationType === 'LUMP_SUM' && (
                  <span className="text-sm font-medium">
                    {formatCurrency(LUMP_SUM_AMOUNT)}
                  </span>
                )}

                {accommodationType === 'FREE' && (
                  <span className="text-sm text-muted-foreground">
                    Bezplatnie
                  </span>
                )}

                {accommodationType === 'NONE' && (
                  <span className="text-sm text-muted-foreground">
                    Brak noclegu
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Summary for lump sum */}
          {accommodationType === 'LUMP_SUM' && nights.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">
                Ryczalt za noclegi:{' '}
              </span>
              <span className="font-semibold">
                {nights.length} x {formatCurrency(LUMP_SUM_AMOUNT)} ={' '}
                {formatCurrency(nights.length * LUMP_SUM_AMOUNT)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
