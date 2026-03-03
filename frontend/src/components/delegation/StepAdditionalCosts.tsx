import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Receipt } from 'lucide-react';
import type { DelegationFormValues } from './DelegationWizard';

const COST_CATEGORIES = [
  { value: 'parking', label: 'Parking' },
  { value: 'highway', label: 'Autostrada / droga platna' },
  { value: 'other', label: 'Inne' },
] as const;

export function StepAdditionalCosts() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<DelegationFormValues>();

  const {
    fields: costFields,
    append: appendCost,
    remove: removeCost,
  } = useFieldArray({
    control,
    name: 'additionalCosts',
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Koszty dodatkowe</h2>
        <p className="text-sm text-muted-foreground">
          Dodaj koszty dodatkowe, np. opłaty parkingowe, autostradowe i inne.
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            appendCost({
              category: 'other',
              description: '',
              amount: '',
              receiptNumber: null,
            })
          }
        >
          <Plus className="mr-1 h-4 w-4" />
          Dodaj koszt
        </Button>
      </div>

      {costFields.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <Receipt className="h-5 w-5" />
          <span>
            Brak dodatkowych kosztow. Kliknij &quot;Dodaj koszt&quot;, aby
            dodac.
          </span>
        </div>
      )}

      {costFields.map((field, index) => (
        <div
          key={field.id}
          className="space-y-3 rounded-lg border p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Koszt {index + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeCost(index)}
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Kategoria *</Label>
              <Controller
                control={control}
                name={`additionalCosts.${index}.category`}
                render={({ field: selectField }) => (
                  <Select
                    value={selectField.value}
                    onValueChange={selectField.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz kategorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {COST_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.additionalCosts?.[index]?.category && (
                <p className="text-xs text-destructive">
                  {errors.additionalCosts[index]?.category?.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Opis *</Label>
              <Input
                placeholder="np. Parking centrum Krakow"
                {...register(`additionalCosts.${index}.description`)}
              />
              {errors.additionalCosts?.[index]?.description && (
                <p className="text-xs text-destructive">
                  {errors.additionalCosts[index]?.description?.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Kwota (PLN) *</Label>
              <Input
                placeholder="0.00"
                {...register(`additionalCosts.${index}.amount`)}
              />
              {errors.additionalCosts?.[index]?.amount && (
                <p className="text-xs text-destructive">
                  {errors.additionalCosts[index]?.amount?.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nr rachunku</Label>
              <Input
                placeholder="opcjonalnie"
                {...register(`additionalCosts.${index}.receiptNumber`)}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
