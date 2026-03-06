import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DelegationWizard,
  type DelegationFormValues,
} from '@/components/delegation/DelegationWizard';
import {
  createDelegation,
  updateDelegation,
  submitDelegation,
} from '@/api/delegations';

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

function normalizeEngineCapacityCm3(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value);
}

function resolveMileageVehicleType(
  mileageDetails: NonNullable<DelegationFormValues['mileageDetails']>
): 'CAR_ABOVE_900' | 'CAR_BELOW_900' | 'MOTORCYCLE' | 'MOPED' {
  if (mileageDetails.vehicleKind === 'MOTORCYCLE') {
    return 'MOTORCYCLE';
  }
  if (mileageDetails.vehicleKind === 'MOPED') {
    return 'MOPED';
  }

  const engineCapacityCm3 = normalizeEngineCapacityCm3(
    mileageDetails.engineCapacityCm3
  );
  return engineCapacityCm3 != null && engineCapacityCm3 > 900
    ? 'CAR_ABOVE_900'
    : 'CAR_BELOW_900';
}

function buildApiPayload(data: DelegationFormValues) {
  const proposedNumber = data.proposedNumber?.trim();
  const mileageDetails = data.mileageDetails
    ? {
        vehicleType: resolveMileageVehicleType(data.mileageDetails),
        engineCapacityCm3:
          data.mileageDetails.vehicleKind === 'CAR'
            ? normalizeEngineCapacityCm3(data.mileageDetails.engineCapacityCm3)
            : null,
        vehiclePlate: data.mileageDetails.vehiclePlate,
        segments: data.mileageDetails.segments.map((s) => ({
          date: s.date,
          startLocation: s.startLocation,
          endLocation: s.endLocation,
          km: s.km,
        })),
      }
    : null;

  return {
    type: data.type ?? 'DOMESTIC',
    proposedNumber: proposedNumber ? proposedNumber : null,
    purpose: data.purpose,
    destination: data.destination,
    departureAt: new Date(data.departureAt).toISOString(),
    returnAt: new Date(data.returnAt).toISOString(),
    foreignCountry: data.foreignCountry ?? null,
    borderCrossingOut: data.borderCrossingOut ? new Date(data.borderCrossingOut).toISOString() : null,
    borderCrossingIn: data.borderCrossingIn ? new Date(data.borderCrossingIn).toISOString() : null,
    transportType: data.transportType,
    vehicleType: mileageDetails?.vehicleType ?? null,
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
    mileageDetails,
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

export default function NewDelegationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draftId, setDraftId] = useState<string | null>(null);
  const creatingDraftPromiseRef = useRef<Promise<string> | null>(null);

  const ensureDelegationId = async (data: DelegationFormValues): Promise<string> => {
    if (draftId) {
      return draftId;
    }

    if (creatingDraftPromiseRef.current) {
      return creatingDraftPromiseRef.current;
    }

    const payload = buildApiPayload(data);
    const createPromise = createDelegation(payload)
      .then((created) => {
        const id = created?.delegation?.id ?? created?.id;
        if (!id) {
          throw new Error('Nie udalo sie utworzyc delegacji.');
        }
        setDraftId(id);
        return id;
      })
      .finally(() => {
        creatingDraftPromiseRef.current = null;
      });

    creatingDraftPromiseRef.current = createPromise;
    return createPromise;
  };

  const saveDraftMutation = useMutation({
    mutationFn: async (data: DelegationFormValues) => {
      const payload = buildApiPayload(data);
      const id = await ensureDelegationId(data);
      return updateDelegation(id, payload);
    },
    onSuccess: (result) => {
      const id = result?.delegation?.id ?? result?.id;
      if (id && !draftId) {
        setDraftId(id);
      }
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      toast.success('Szkic zapisany', {
        description: 'Delegacja zostala zapisana jako szkic.',
      });
    },
    onError: (err: any) => {
      const message =
        err.response?.data?.message || 'Nie udalo sie zapisac szkicu.';
      toast.error('Blad zapisu', { description: message });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: DelegationFormValues) => {
      const payload = buildApiPayload(data);
      const id = await ensureDelegationId(data);
      await updateDelegation(id, payload);

      if (!id) {
        throw new Error('Nie udalo sie utworzyc delegacji.');
      }

      // Then submit it
      return submitDelegation(id);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      toast.success('Delegacja zlozona', {
        description: 'Delegacja zostala pomyslnie zlozona do rozliczenia.',
      });
      const id = result?.delegation?.id ?? result?.id ?? draftId;
      navigate(id ? `/delegations/${id}` : '/');
    },
    onError: (err: any) => {
      const message =
        err.response?.data?.message || 'Nie udalo sie zlozyc delegacji.';
      toast.error('Blad skladania', { description: message });
    },
  });

  const handleSaveDraft = async (data: DelegationFormValues) => {
    await saveDraftMutation.mutateAsync(data);
  };

  const handleSubmit = async (data: DelegationFormValues) => {
    await submitMutation.mutateAsync(data);
  };

  const isSaving = saveDraftMutation.isPending || submitMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nowa delegacja</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wypelnij formularz krok po kroku, aby utworzyc nowa delegacje.
        </p>
      </div>

      <DelegationWizard
        delegationId={draftId ?? undefined}
        ensureDelegationId={ensureDelegationId}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
        isSaving={isSaving}
      />
    </div>
  );
}
