import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DelegationWizard,
  type DelegationFormValues,
} from '@/components/delegation/DelegationWizard';
import {
  getDelegation,
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

function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) return '';

  const date = new Date(value);
  if (isNaN(date.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
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

function inferFormAccommodationType(delegation: any): DelegationFormValues['accommodationType'] {
  const nonEmptyTypes = (delegation.days ?? [])
    .map((d: any) => d?.accommodationType)
    .filter((type: any) =>
      type === 'RECEIPT' || type === 'LUMP_SUM' || type === 'FREE'
    );

  if (nonEmptyTypes.length === 0) {
    return (delegation.accommodationType ?? 'NONE') as DelegationFormValues['accommodationType'];
  }

  const uniqueTypes = Array.from(new Set(nonEmptyTypes));
  if (uniqueTypes.length > 1) {
    return 'MIXED';
  }

  return uniqueTypes[0] as DelegationFormValues['accommodationType'];
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
        distanceKm: data.mileageDetails.distanceKm,
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
    borderCrossingOut: data.borderCrossingOut
      ? new Date(data.borderCrossingOut).toISOString()
      : null,
    borderCrossingIn: data.borderCrossingIn
      ? new Date(data.borderCrossingIn).toISOString()
      : null,
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

function mapDelegationToFormValues(delegation: any): DelegationFormValues {
  return {
    proposedNumber: delegation.number ?? null,
    purpose: delegation.purpose ?? '',
    destination: delegation.destination ?? '',
    departureAt: toDateTimeLocalValue(delegation.departureAt),
    returnAt: toDateTimeLocalValue(delegation.returnAt),
    type: delegation.type ?? 'DOMESTIC',
    foreignCountry: delegation.foreignCountry ?? null,
    borderCrossingOut: delegation.borderCrossingOut
      ? toDateTimeLocalValue(delegation.borderCrossingOut)
      : null,
    borderCrossingIn: delegation.borderCrossingIn
      ? toDateTimeLocalValue(delegation.borderCrossingIn)
      : null,
    transportType: delegation.transportType ?? 'COMPANY_VEHICLE',
    accommodationType: inferFormAccommodationType(delegation),
    advanceAmount: String(delegation.advanceAmount ?? '0'),
    days: [...(delegation.days ?? [])]
      .sort((a: any, b: any) => a.dayNumber - b.dayNumber)
      .map((d: any) => ({
        dayNumber: d.dayNumber,
        date: String(d.date ?? '').slice(0, 10),
        breakfastProvided: !!d.breakfastProvided,
        lunchProvided: !!d.lunchProvided,
        dinnerProvided: !!d.dinnerProvided,
        accommodationType: d.accommodationType ?? 'NONE',
        accommodationCost: d.accommodationCost ?? null,
        accommodationReceiptNumber: d.accommodationReceiptNumber ?? null,
        accommodationCurrency: d.accommodationCurrency ?? null,
        isForeign: !!d.isForeign,
      })),
    mileageDetails: delegation.mileageDetails
      ? {
          vehicleKind:
            delegation.mileageDetails.vehicleType === 'MOTORCYCLE'
              ? 'MOTORCYCLE'
              : delegation.mileageDetails.vehicleType === 'MOPED'
              ? 'MOPED'
              : 'CAR',
          engineCapacityCm3:
            delegation.mileageDetails.vehicleType === 'MOTORCYCLE' ||
            delegation.mileageDetails.vehicleType === 'MOPED'
              ? null
              : delegation.mileageDetails.engineCapacityCm3 != null
              ? toNumber(delegation.mileageDetails.engineCapacityCm3, 900)
              : delegation.mileageDetails.vehicleType === 'CAR_ABOVE_900'
              ? 901
              : 900,
          vehiclePlate: delegation.mileageDetails.vehiclePlate ?? '',
          distanceKm: toNumber(delegation.mileageDetails.distanceKm, 0),
        }
      : null,
    transportReceipts: (delegation.transportReceipts ?? []).map((r: any) => ({
      description: r.description ?? '',
      amount: String(r.amount ?? '0'),
      receiptNumber: r.receiptNumber ?? '',
    })),
    additionalCosts: (delegation.additionalCosts ?? []).map((c: any) => ({
      description: c.description ?? '',
      category: c.category ?? '',
      amount: String(c.amount ?? '0'),
      receiptNumber: c.receiptNumber ?? '',
    })),
  };
}

export default function EditDelegationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: delegationData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['delegation', id],
    queryFn: () => getDelegation(id!),
    enabled: !!id,
  });

  const delegation = delegationData?.delegation ?? delegationData;

  const saveDraftMutation = useMutation({
    mutationFn: async (data: DelegationFormValues) => {
      if (!id) throw new Error('Brak identyfikatora delegacji.');
      const payload = buildApiPayload(data);
      return updateDelegation(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegation', id] });
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      toast.success('Szkic zapisany', {
        description: 'Zmiany w delegacji zostaly zapisane.',
      });
    },
    onError: (err: any) => {
      const message =
        err.response?.data?.message || 'Nie udalo sie zapisac zmian.';
      toast.error('Blad zapisu', { description: message });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: DelegationFormValues) => {
      if (!id) throw new Error('Brak identyfikatora delegacji.');
      const payload = buildApiPayload(data);
      await updateDelegation(id, payload);
      return submitDelegation(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegation', id] });
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      toast.success('Delegacja zlozona', {
        description: 'Delegacja zostala pomyslnie zlozona do rozliczenia.',
      });
      navigate(id ? `/delegations/${id}` : '/');
    },
    onError: (err: any) => {
      const message =
        err.response?.data?.message || 'Nie udalo sie zlozyc delegacji.';
      toast.error('Blad skladania', { description: message });
    },
  });

  const initialValues = useMemo(
    () => (delegation ? mapDelegationToFormValues(delegation) : undefined),
    [delegation]
  );

  const handleSaveDraft = async (data: DelegationFormValues) => {
    await saveDraftMutation.mutateAsync(data);
  };

  const handleSubmit = async (data: DelegationFormValues) => {
    await submitMutation.mutateAsync(data);
  };

  const isSaving = saveDraftMutation.isPending || submitMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !delegation || !initialValues) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Powrot do pulpitu
        </Button>
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5" />
          Nie udalo sie wczytac delegacji do edycji.
        </div>
      </div>
    );
  }

  if (delegation.status !== 'DRAFT') {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate(`/delegations/${id}`)}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Powrot do delegacji
        </Button>
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-700">
          <AlertCircle className="h-5 w-5" />
          Edytowac mozna tylko delegacje w statusie szkic.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edycja delegacji</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wprowadz zmiany i zapisz szkic lub zloz delegacje.
        </p>
      </div>

      <DelegationWizard
        initialValues={initialValues}
        delegationId={id}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
        isSaving={isSaving}
      />
    </div>
  );
}
