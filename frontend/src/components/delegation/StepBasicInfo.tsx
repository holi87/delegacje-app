import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, Globe } from 'lucide-react';
import { getForeignRates } from '@/api/admin';
import type { DelegationFormValues } from './DelegationWizard';
import type { ForeignDietRate } from '../../../../shared/types';

/**
 * Calculate delegation duration display text.
 * Doba delegacyjna counts from departure hour, not midnight.
 */
function formatDuration(departureAt: string, returnAt: string): string | null {
  if (!departureAt || !returnAt) return null;

  const dep = new Date(departureAt);
  const ret = new Date(returnAt);

  if (isNaN(dep.getTime()) || isNaN(ret.getTime())) return null;
  if (ret <= dep) return null;

  const diffMs = ret.getTime() - dep.getTime();
  const totalMinutes = Math.floor(diffMs / 60000);

  const fullDays = Math.floor(totalMinutes / (24 * 60));
  const minutesAfterFullDays = totalMinutes - fullDays * 24 * 60;
  const remainingHours = Math.floor(minutesAfterFullDays / 60);
  const remainingMinutes = minutesAfterFullDays - remainingHours * 60;

  const parts: string[] = [];
  if (fullDays > 0) {
    const dobyLabel =
      fullDays === 1 ? 'doba' : fullDays < 5 ? 'doby' : 'dob';
    parts.push(`${fullDays} ${dobyLabel}`);
  }
  if (remainingHours > 0) {
    const hoursLabel =
      remainingHours === 1
        ? 'godzina'
        : remainingHours < 5
        ? 'godziny'
        : 'godzin';
    parts.push(`${remainingHours} ${hoursLabel}`);
  }
  if (remainingMinutes > 0) {
    parts.push(`${remainingMinutes} min`);
  }

  if (parts.length === 0) return null;
  return parts.join(', ');
}

export function StepBasicInfo() {
  const {
    register,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<DelegationFormValues>();

  const departureAt = watch('departureAt');
  const returnAt = watch('returnAt');
  const delegationType = watch('type');

  const durationText = useMemo(
    () => formatDuration(departureAt, returnAt),
    [departureAt, returnAt]
  );

  // Fetch foreign rates for the country selector
  const { data: foreignRatesData } = useQuery({
    queryKey: ['admin', 'rates', 'foreign'],
    queryFn: getForeignRates,
    enabled: delegationType === 'FOREIGN',
  });

  const foreignRates: ForeignDietRate[] = foreignRatesData?.rates ?? foreignRatesData ?? [];

  // Get unique countries (latest rate per country)
  const countries = useMemo(() => {
    const countryMap = new Map<string, ForeignDietRate>();
    for (const rate of foreignRates) {
      if (!countryMap.has(rate.countryCode)) {
        countryMap.set(rate.countryCode, rate);
      }
    }
    return Array.from(countryMap.values()).sort((a, b) =>
      a.countryName.localeCompare(b.countryName, 'pl')
    );
  }, [foreignRates]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Dane podstawowe</h2>
        <p className="text-sm text-muted-foreground">
          Podaj cel, miejsce i daty delegacji.
        </p>
      </div>

      {/* Delegation type */}
      <div className="space-y-2">
        <Label>Typ delegacji *</Label>
        <Select
          value={delegationType ?? 'DOMESTIC'}
          onValueChange={(value) =>
            setValue('type', value as any, {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Wybierz typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DOMESTIC">Krajowa</SelectItem>
            <SelectItem value="FOREIGN">Zagraniczna</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Optional delegation number */}
      <div className="space-y-2">
        <Label htmlFor="proposedNumber">Numer delegacji (opcjonalnie)</Label>
        <Input
          id="proposedNumber"
          placeholder="np. 0001/DEL/2026 albo XYZ_DK_001"
          {...register('proposedNumber')}
        />
        <p className="text-xs text-muted-foreground">
          Jesli pole pozostanie puste, system nada numer automatycznie.
        </p>
        {errors.proposedNumber && (
          <p className="text-sm text-destructive">
            {(errors.proposedNumber as any).message}
          </p>
        )}
      </div>

      {/* Purpose */}
      <div className="space-y-2">
        <Label htmlFor="purpose">Cel delegacji *</Label>
        <Textarea
          id="purpose"
          placeholder="np. Spotkanie z klientem, szkolenie..."
          {...register('purpose')}
        />
        {errors.purpose && (
          <p className="text-sm text-destructive">{errors.purpose.message}</p>
        )}
      </div>

      {/* Destination */}
      <div className="space-y-2">
        <Label htmlFor="destination">Miejsce delegacji *</Label>
        <Input
          id="destination"
          placeholder={delegationType === 'FOREIGN' ? 'np. Berlin, Monachium...' : 'np. Krakow, Warszawa...'}
          {...register('destination')}
        />
        {errors.destination && (
          <p className="text-sm text-destructive">
            {errors.destination.message}
          </p>
        )}
      </div>

      {/* Foreign country selector */}
      {delegationType === 'FOREIGN' && (
        <div className="space-y-2">
          <Label>Kraj docelowy *</Label>
          <Select
            value={watch('foreignCountry') ?? ''}
            onValueChange={(value) =>
              setValue('foreignCountry', value, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Wybierz kraj" />
            </SelectTrigger>
            <SelectContent>
              {countries.map((rate) => (
                <SelectItem key={rate.countryCode} value={rate.countryCode}>
                  <div className="flex items-center gap-2">
                    <Globe className="h-3 w-3" />
                    {rate.countryName} ({rate.currency})
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.foreignCountry && (
            <p className="text-sm text-destructive">
              {(errors.foreignCountry as any).message}
            </p>
          )}
        </div>
      )}

      {/* Departure / Return dates */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="departureAt">Data i godzina wyjazdu *</Label>
          <Controller
            name="departureAt"
            control={control}
            render={({ field }) => (
              <Input
                id="departureAt"
                type="datetime-local"
                step={60}
                value={field.value ?? ''}
                onChange={(event) =>
                  setValue('departureAt', event.target.value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          {errors.departureAt && (
            <p className="text-sm text-destructive">
              {errors.departureAt.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="returnAt">Data i godzina powrotu *</Label>
          <Controller
            name="returnAt"
            control={control}
            render={({ field }) => (
              <Input
                id="returnAt"
                type="datetime-local"
                step={60}
                value={field.value ?? ''}
                onChange={(event) =>
                  setValue('returnAt', event.target.value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          {errors.returnAt && (
            <p className="text-sm text-destructive">
              {errors.returnAt.message}
            </p>
          )}
        </div>
      </div>

      {/* Border crossing times (foreign only) */}
      {delegationType === 'FOREIGN' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="borderCrossingOut">
              Przekroczenie granicy (wyjazd z PL) *
            </Label>
            <Controller
              name="borderCrossingOut"
              control={control}
              render={({ field }) => (
                <Input
                  id="borderCrossingOut"
                  type="datetime-local"
                  step={60}
                  value={field.value ?? ''}
                  onChange={(event) =>
                    setValue('borderCrossingOut', event.target.value, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    })
                  }
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
            {errors.borderCrossingOut && (
              <p className="text-sm text-destructive">
                {(errors.borderCrossingOut as any).message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="borderCrossingIn">
              Przekroczenie granicy (powrot do PL) *
            </Label>
            <Controller
              name="borderCrossingIn"
              control={control}
              render={({ field }) => (
                <Input
                  id="borderCrossingIn"
                  type="datetime-local"
                  step={60}
                  value={field.value ?? ''}
                  onChange={(event) =>
                    setValue('borderCrossingIn', event.target.value, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    })
                  }
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
            {errors.borderCrossingIn && (
              <p className="text-sm text-destructive">
                {(errors.borderCrossingIn as any).message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Duration display */}
      {durationText && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Czas trwania:</span>
          <span className="font-medium">{durationText}</span>
        </div>
      )}
    </div>
  );
}
