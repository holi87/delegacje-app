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
import { Plus, Trash2 } from 'lucide-react';
import type { DelegationFormValues } from './DelegationWizard';

const TRANSPORT_TYPES = [
  { value: 'COMPANY_VEHICLE', label: 'Pojazd sluzbowy' },
  { value: 'PUBLIC_TRANSPORT', label: 'Transport publiczny (bilety)' },
  { value: 'PRIVATE_VEHICLE', label: 'Pojazd prywatny (kilometrowka)' },
  { value: 'MIXED', label: 'Mieszany' },
] as const;

const VEHICLE_TYPES = [
  { value: 'CAR', label: 'Samochod osobowy' },
  { value: 'MOTORCYCLE', label: 'Motocykl' },
  { value: 'MOPED', label: 'Motorower' },
] as const;

export function StepTransport() {
  const {
    register,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<DelegationFormValues>();

  const transportType = watch('transportType');
  const mileageVehicleKind = watch('mileageDetails.vehicleKind');
  const needsMileage =
    transportType === 'PRIVATE_VEHICLE' || transportType === 'MIXED';
  const needsReceipts =
    transportType === 'PUBLIC_TRANSPORT' || transportType === 'MIXED';
  const isPassengerCar = mileageVehicleKind === 'CAR';

  const {
    fields: receiptFields,
    append: appendReceipt,
    remove: removeReceipt,
  } = useFieldArray({
    control,
    name: 'transportReceipts',
  });

  const handleTransportTypeChange = (value: string) => {
    setValue('transportType', value as DelegationFormValues['transportType']);

    // Clear mileage details if not needed
    if (value !== 'PRIVATE_VEHICLE' && value !== 'MIXED') {
      setValue('mileageDetails', null);
    } else if (!watch('mileageDetails')) {
      setValue('mileageDetails', {
        vehicleKind: 'CAR',
        engineCapacityCm3: null,
        vehiclePlate: '',
        distanceKm: 0,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Transport</h2>
        <p className="text-sm text-muted-foreground">
          Wybierz rodzaj transportu i podaj szczegoly.
        </p>
      </div>

      {/* Transport type */}
      <div className="space-y-2">
        <Label>Rodzaj transportu *</Label>
        <Controller
          control={control}
          name="transportType"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(val) => {
                field.onChange(val);
                handleTransportTypeChange(val);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz rodzaj transportu" />
              </SelectTrigger>
              <SelectContent>
                {TRANSPORT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Mileage details (private vehicle / mixed) */}
      {needsMileage && (
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="font-medium">Dane pojazdu i kilometrowka</h3>

          <div className="space-y-2">
            <Label>Rodzaj pojazdu *</Label>
            <Controller
              control={control}
              name="mileageDetails.vehicleKind"
              render={({ field }) => (
                <Select
                  value={field.value ?? 'CAR'}
                  onValueChange={(value) => {
                    field.onChange(value);
                    if (value !== 'CAR') {
                      setValue('mileageDetails.engineCapacityCm3', null);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz rodzaj pojazdu" />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {isPassengerCar && (
            <div className="space-y-2">
              <Label htmlFor="engineCapacityCm3">Pojemnosc silnika (cm3) *</Label>
              <Input
                id="engineCapacityCm3"
                type="number"
                min={1}
                step={1}
                placeholder="np. 1598"
                {...register('mileageDetails.engineCapacityCm3', {
                  setValueAs: (value) => {
                    if (value === '' || value == null) return null;
                    const parsed = Number(value);
                    return Number.isFinite(parsed) ? parsed : null;
                  },
                })}
              />
              {errors.mileageDetails?.engineCapacityCm3 && (
                <p className="text-sm text-destructive">
                  {errors.mileageDetails.engineCapacityCm3.message}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vehiclePlate">Nr rejestracyjny *</Label>
              <Input
                id="vehiclePlate"
                placeholder="np. WA 12345"
                {...register('mileageDetails.vehiclePlate')}
              />
              {errors.mileageDetails?.vehiclePlate && (
                <p className="text-sm text-destructive">
                  {errors.mileageDetails.vehiclePlate.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="distanceKm">Dystans (km) *</Label>
              <Input
                id="distanceKm"
                type="number"
                min={1}
                step={1}
                placeholder="np. 620"
                {...register('mileageDetails.distanceKm', {
                  valueAsNumber: true,
                })}
              />
              {errors.mileageDetails?.distanceKm && (
                <p className="text-sm text-destructive">
                  {errors.mileageDetails.distanceKm.message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transport receipts (public transport / mixed) */}
      {needsReceipts && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Bilety / rachunki za transport</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                appendReceipt({
                  description: '',
                  amount: '',
                  receiptNumber: '',
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Dodaj bilet
            </Button>
          </div>

          {receiptFields.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Brak dodanych biletow. Kliknij &quot;Dodaj bilet&quot;, aby
              dodac.
            </p>
          )}

          {receiptFields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_120px_120px_auto]"
            >
              <div className="space-y-1">
                <Label className="text-xs">Opis</Label>
                <Input
                  placeholder="np. Bilet PKP Warszawa-Krakow"
                  {...register(`transportReceipts.${index}.description`)}
                />
                {errors.transportReceipts?.[index]?.description && (
                  <p className="text-xs text-destructive">
                    {errors.transportReceipts[index]?.description?.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Kwota (PLN)</Label>
                <Input
                  placeholder="0.00"
                  {...register(`transportReceipts.${index}.amount`)}
                />
                {errors.transportReceipts?.[index]?.amount && (
                  <p className="text-xs text-destructive">
                    {errors.transportReceipts[index]?.amount?.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Nr dokumentu *</Label>
                <Input
                  placeholder="np. FV/03/2026/0012"
                  {...register(`transportReceipts.${index}.receiptNumber`)}
                />
                {errors.transportReceipts?.[index]?.receiptNumber && (
                  <p className="text-xs text-destructive">
                    {errors.transportReceipts[index]?.receiptNumber?.message}
                  </p>
                )}
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeReceipt(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
