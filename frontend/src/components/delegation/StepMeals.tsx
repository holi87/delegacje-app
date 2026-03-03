import { useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { UtensilsCrossed } from 'lucide-react';
import type { DelegationFormValues } from './DelegationWizard';

/**
 * Calculate delegation days (doby delegacyjne) from departure/return.
 * A doba starts from departure hour, not midnight.
 *
 * Returns an array of { dayNumber, startDate, endDate, hours }
 */
interface DelegationDay {
  dayNumber: number;
  startDate: Date;
  endDate: Date;
  hours: number;
  dateLabel: string;
}

function isForeignSegmentInDay(
  dayStart: Date,
  dayEnd: Date,
  borderCrossingOut: string,
  borderCrossingIn: string
): boolean {
  const borderOut = new Date(borderCrossingOut);
  const borderIn = new Date(borderCrossingIn);
  if (isNaN(borderOut.getTime()) || isNaN(borderIn.getTime()) || borderIn <= borderOut) {
    return false;
  }

  // Any overlap between [dayStart, dayEnd) and [borderOut, borderIn)
  return dayEnd > borderOut && dayStart < borderIn;
}

function calculateDelegationDays(
  departureAt: string,
  returnAt: string
): DelegationDay[] {
  if (!departureAt || !returnAt) return [];

  const dep = new Date(departureAt);
  const ret = new Date(returnAt);

  if (isNaN(dep.getTime()) || isNaN(ret.getTime())) return [];
  if (ret <= dep) return [];

  const diffMs = ret.getTime() - dep.getTime();
  const totalHours = diffMs / (1000 * 60 * 60);

  const days: DelegationDay[] = [];
  const fullDays = Math.floor(totalHours / 24);
  const remainingHours = totalHours - fullDays * 24;

  for (let i = 0; i < fullDays; i++) {
    const start = new Date(dep.getTime() + i * 24 * 60 * 60 * 1000);
    const end = new Date(dep.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
    days.push({
      dayNumber: i + 1,
      startDate: start,
      endDate: end,
      hours: 24,
      dateLabel: formatDateRange(start, end),
    });
  }

  if (remainingHours > 0) {
    const start = new Date(dep.getTime() + fullDays * 24 * 60 * 60 * 1000);
    days.push({
      dayNumber: fullDays + 1,
      startDate: start,
      endDate: ret,
      hours: Math.round(remainingHours * 100) / 100,
      dateLabel: formatDateRange(start, ret),
    });
  }

  return days;
}

function formatDateRange(start: Date, end: Date): string {
  const fmtDate = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  const fmtTime = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  return `${fmtDate(start)} ${fmtTime(start)} \u2013 ${fmtDate(end)} ${fmtTime(end)}`;
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function StepMeals() {
  const { watch, setValue } = useFormContext<DelegationFormValues>();

  const departureAt = watch('departureAt');
  const returnAt = watch('returnAt');
  const borderCrossingOut = watch('borderCrossingOut');
  const borderCrossingIn = watch('borderCrossingIn');
  const days = watch('days');
  const delegationType = watch('type');

  const delegationDays = useMemo(
    () => calculateDelegationDays(departureAt, returnAt),
    [departureAt, returnAt]
  );

  // Sync days array with calculated delegation days
  useEffect(() => {
    if (delegationDays.length === 0) return;

    const currentDays = days || [];

    // Build a new days array preserving existing meal/accommodation data
    const newDays = delegationDays.map((dd, idx) => {
      const existing = currentDays[idx];
      const autoForeign =
        delegationType === 'FOREIGN' &&
        !!borderCrossingOut &&
        !!borderCrossingIn &&
        isForeignSegmentInDay(dd.startDate, dd.endDate, borderCrossingOut, borderCrossingIn);

      return {
        dayNumber: dd.dayNumber,
        date: dd.startDate.toISOString().slice(0, 10),
        breakfastProvided: existing?.breakfastProvided ?? false,
        lunchProvided: existing?.lunchProvided ?? false,
        dinnerProvided: existing?.dinnerProvided ?? false,
        accommodationType: existing?.accommodationType ?? 'NONE' as const,
        accommodationCost: existing?.accommodationCost ?? null,
        isForeign: delegationType === 'FOREIGN' ? autoForeign : false,
      };
    });

    // Only update if length or date content changed
    if (
      newDays.length !== currentDays.length ||
      newDays.some(
        (d, i) =>
          d.dayNumber !== currentDays[i]?.dayNumber ||
          d.date !== currentDays[i]?.date ||
          d.isForeign !== currentDays[i]?.isForeign
      )
    ) {
      setValue('days', newDays);
    }
  }, [
    delegationDays.length,
    departureAt,
    returnAt,
    delegationType,
    borderCrossingOut,
    borderCrossingIn,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMeal = (
    dayIndex: number,
    meal: 'breakfastProvided' | 'lunchProvided' | 'dinnerProvided'
  ) => {
    const current = days[dayIndex]?.[meal] ?? false;
    setValue(`days.${dayIndex}.${meal}`, !current);
  };

  if (delegationDays.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Posilki zapewnione</h2>
          <p className="text-sm text-muted-foreground">
            Zaznacz posilki, ktore zostaly zapewnione w kazdej dobie
            delegacyjnej.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <UtensilsCrossed className="h-5 w-5" />
          <span>
            Uzupelnij daty wyjazdu i powrotu w kroku 1, aby zobaczyc doby
            delegacyjne.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Posilki zapewnione</h2>
        <p className="text-sm text-muted-foreground">
          Zaznacz posilki, ktore zostaly zapewnione w kazdej dobie
          delegacyjnej. Pomniejszenie diety liczy sie zawsze od pelnej stawki
          (45 zl).
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Doba</TableHead>
              <TableHead>Okres</TableHead>
              <TableHead className="w-20 text-center">Godziny</TableHead>
              <TableHead className="w-28 text-center">Sniadanie</TableHead>
              <TableHead className="w-28 text-center">Obiad</TableHead>
              <TableHead className="w-28 text-center">Kolacja</TableHead>
              {delegationType === 'FOREIGN' && (
                <TableHead className="w-32 text-center">Zagraniczny</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {delegationDays.map((dd, idx) => (
              <TableRow key={dd.dayNumber}>
                <TableCell className="font-medium">{dd.dayNumber}</TableCell>
                <TableCell className="text-xs">{dd.dateLabel}</TableCell>
                <TableCell className="text-center text-xs">
                  {formatHours(dd.hours)}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Checkbox
                      checked={days[idx]?.breakfastProvided ?? false}
                      onCheckedChange={() =>
                        toggleMeal(idx, 'breakfastProvided')
                      }
                    />
                    <Label className="text-xs font-normal sm:hidden">
                      Sn.
                    </Label>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Checkbox
                      checked={days[idx]?.lunchProvided ?? false}
                      onCheckedChange={() => toggleMeal(idx, 'lunchProvided')}
                    />
                    <Label className="text-xs font-normal sm:hidden">
                      Ob.
                    </Label>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Checkbox
                      checked={days[idx]?.dinnerProvided ?? false}
                      onCheckedChange={() => toggleMeal(idx, 'dinnerProvided')}
                    />
                    <Label className="text-xs font-normal sm:hidden">
                      Kol.
                    </Label>
                  </div>
                </TableCell>
                {delegationType === 'FOREIGN' && (
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Checkbox
                        checked={!!days[idx]?.isForeign}
                        onCheckedChange={(checked) => {
                          const updated = [...days];
                          updated[idx] = { ...updated[idx], isForeign: !!checked };
                          setValue('days', updated);
                        }}
                      />
                      <Label className="text-xs font-normal sm:hidden">
                        Zagr.
                      </Label>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <p>
          <strong>Uwaga:</strong> Doba delegacyjna liczy sie od godziny
          wyjazdu, a nie od polnocy. Pomniejszenie diety za posilek wynosi:
          sniadanie 25% (11,25 zl), obiad 50% (22,50 zl), kolacja 25% (11,25
          zl) — zawsze od pelnej diety 45 zl.
        </p>
      </div>
    </div>
  );
}
