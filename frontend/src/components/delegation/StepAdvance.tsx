import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Banknote } from 'lucide-react';
import type { DelegationFormValues } from './DelegationWizard';

export function StepAdvance() {
  const {
    register,
    formState: { errors },
  } = useFormContext<DelegationFormValues>();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Zaliczka</h2>
        <p className="text-sm text-muted-foreground">
          Podaj kwote zaliczki otrzymanej przed wyjazdem. Jesli nie otrzymales
          zaliczki, pozostaw wartosc 0.
        </p>
      </div>

      <div className="mx-auto max-w-sm space-y-4">
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
          <Banknote className="h-8 w-8 text-muted-foreground" />
          <div className="flex-1 space-y-2">
            <Label htmlFor="advanceAmount">Kwota zaliczki (PLN)</Label>
            <Input
              id="advanceAmount"
              type="number"
              step="0.01"
              min={0}
              placeholder="0.00"
              {...register('advanceAmount')}
            />
            {errors.advanceAmount && (
              <p className="text-sm text-destructive">
                {errors.advanceAmount.message}
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Zaliczka zostanie odliczona od calkowitych kosztow delegacji. Jesli
          zaliczka przekracza koszty, roznica bedzie do zwrotu.
        </p>
      </div>
    </div>
  );
}
