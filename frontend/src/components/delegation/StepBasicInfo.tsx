import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock } from 'lucide-react';
import type { DelegationFormValues } from './DelegationWizard';

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
  const totalHours = totalMinutes / 60;

  const fullDays = Math.floor(totalHours / 24);
  const remainingHours = Math.floor(totalHours - fullDays * 24);
  const remainingMinutes = totalMinutes - Math.floor(totalHours) * 60;

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
  if (remainingMinutes > 0 && fullDays === 0) {
    const minLabel = 'min';
    parts.push(`${remainingMinutes} ${minLabel}`);
  }

  if (parts.length === 0) return null;
  return parts.join(', ');
}

export function StepBasicInfo() {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<DelegationFormValues>();

  const departureAt = watch('departureAt');
  const returnAt = watch('returnAt');

  const durationText = useMemo(
    () => formatDuration(departureAt, returnAt),
    [departureAt, returnAt]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Dane podstawowe</h2>
        <p className="text-sm text-muted-foreground">
          Podaj cel, miejsce i daty delegacji.
        </p>
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
          placeholder="np. Krakow, Warszawa..."
          {...register('destination')}
        />
        {errors.destination && (
          <p className="text-sm text-destructive">
            {errors.destination.message}
          </p>
        )}
      </div>

      {/* Departure / Return dates */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="departureAt">Data i godzina wyjazdu *</Label>
          <Input
            id="departureAt"
            type="datetime-local"
            {...register('departureAt')}
          />
          {errors.departureAt && (
            <p className="text-sm text-destructive">
              {errors.departureAt.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="returnAt">Data i godzina powrotu *</Label>
          <Input
            id="returnAt"
            type="datetime-local"
            {...register('returnAt')}
          />
          {errors.returnAt && (
            <p className="text-sm text-destructive">
              {errors.returnAt.message}
            </p>
          )}
        </div>
      </div>

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
