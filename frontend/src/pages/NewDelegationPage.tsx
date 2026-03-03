import { useState } from 'react';
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

function buildApiPayload(data: DelegationFormValues) {
  return {
    type: data.type ?? 'DOMESTIC',
    purpose: data.purpose,
    destination: data.destination,
    departureAt: new Date(data.departureAt).toISOString(),
    returnAt: new Date(data.returnAt).toISOString(),
    foreignCountry: data.foreignCountry ?? null,
    borderCrossingOut: data.borderCrossingOut ? new Date(data.borderCrossingOut).toISOString() : null,
    borderCrossingIn: data.borderCrossingIn ? new Date(data.borderCrossingIn).toISOString() : null,
    transportType: data.transportType,
    vehicleType: data.mileageDetails?.vehicleType ?? null,
    accommodationType: data.accommodationType,
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
      receiptNumber: r.receiptNumber || null,
    })),
    additionalCosts: data.additionalCosts.map((c) => ({
      description: c.description,
      category: c.category,
      amount: parseDecimal(c.amount, 'additionalCosts.amount'),
      receiptNumber: c.receiptNumber || null,
    })),
  };
}

export default function NewDelegationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draftId, setDraftId] = useState<string | null>(null);

  const saveDraftMutation = useMutation({
    mutationFn: async (data: DelegationFormValues) => {
      const payload = buildApiPayload(data);

      if (draftId) {
        return updateDelegation(draftId, payload);
      }
      return createDelegation(payload);
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

      let id = draftId;

      // Create or update the delegation first
      if (id) {
        await updateDelegation(id, payload);
      } else {
        const created = await createDelegation(payload);
        id = created?.delegation?.id ?? created?.id;
      }

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
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
        isSaving={isSaving}
      />
    </div>
  );
}
