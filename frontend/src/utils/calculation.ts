import type {
  CalculationDayResult,
  CalculationResult,
  ForeignCalculationResult,
} from '../../../shared/types';

export type ApiCalculationResult = CalculationResult | ForeignCalculationResult;

export interface NormalizedCalculationResult {
  isForeign: boolean;
  duration: {
    totalHours: number;
    fullDays: number;
    remainingHours: number;
    domesticHours?: number;
    foreignHours?: number;
  };
  diet: {
    rateUsed: string | number | null;
    days: CalculationDayResult[];
    total: string | number;
    domesticTotal?: string | number;
    foreignTotal?: string | number;
  };
  accommodation: {
    nights: Array<any>;
    total: string | number;
  };
  transport: {
    type: string;
    mileage: any;
    receipts: Array<any>;
    localTransportLumpSum: string | number;
    total: string | number;
  };
  additionalCosts: {
    items: Array<any>;
    total: string | number;
  };
  summary: {
    dietTotal: string | number;
    accommodationTotal: string | number;
    transportTotal: string | number;
    additionalTotal: string | number;
    grandTotal: string | number;
    advanceAmount: string | number;
    amountDue: string | number;
    domesticDietTotal?: string | number;
    foreignDietTotal?: string | number;
  };
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function isForeignCalculationResult(
  result: ApiCalculationResult
): result is ForeignCalculationResult {
  const maybeForeign = result as ForeignCalculationResult;
  return (
    Array.isArray(maybeForeign?.diet?.domesticDays) ||
    Array.isArray(maybeForeign?.diet?.foreignDays)
  );
}

export function normalizeCalculationResult(
  result: ApiCalculationResult | null | undefined
): NormalizedCalculationResult | null {
  if (!result) return null;

  if (isForeignCalculationResult(result)) {
    const totalHours = toNumber(result.duration?.totalHours);
    const fullDays = Math.floor(totalHours / 24);
    const remainingHours = Math.max(0, totalHours - fullDays * 24);
    const days = [
      ...(result.diet?.domesticDays ?? []),
      ...(result.diet?.foreignDays ?? []),
    ].sort((a, b) => a.dayNumber - b.dayNumber);

    return {
      isForeign: true,
      duration: {
        totalHours,
        fullDays,
        remainingHours,
        domesticHours: toNumber(result.duration?.domesticHours),
        foreignHours: toNumber(result.duration?.foreignHours),
      },
      diet: {
        rateUsed: null,
        days,
        total: result.diet?.total ?? 0,
        domesticTotal: result.diet?.domesticTotal ?? 0,
        foreignTotal: result.diet?.foreignTotal ?? 0,
      },
      accommodation: {
        nights: result.accommodation?.nights ?? [],
        total: result.accommodation?.total ?? 0,
      },
      transport: {
        type: result.transport?.type ?? 'COMPANY_VEHICLE',
        mileage: result.transport?.mileage ?? null,
        receipts: result.transport?.receipts ?? [],
        localTransportLumpSum: result.transport?.localTransportLumpSum ?? 0,
        total: result.transport?.total ?? 0,
      },
      additionalCosts: {
        items: result.additionalCosts?.items ?? [],
        total: result.additionalCosts?.total ?? 0,
      },
      summary: {
        dietTotal: result.summary?.dietTotal ?? 0,
        accommodationTotal: result.summary?.accommodationTotal ?? 0,
        transportTotal: result.summary?.transportTotal ?? 0,
        additionalTotal: result.summary?.additionalTotal ?? 0,
        grandTotal: result.summary?.grandTotal ?? 0,
        advanceAmount: result.summary?.advanceAmount ?? 0,
        amountDue: result.summary?.amountDue ?? 0,
        domesticDietTotal: result.summary?.domesticDietTotal ?? 0,
        foreignDietTotal: result.summary?.foreignDietTotal ?? 0,
      },
    };
  }

  const totalHours = toNumber(
    result.duration?.totalHours,
    toNumber(result.duration?.fullDays) * 24 + toNumber(result.duration?.remainingHours)
  );
  const fullDays =
    typeof result.duration?.fullDays === 'number'
      ? result.duration.fullDays
      : Math.floor(totalHours / 24);
  const remainingHours =
    typeof result.duration?.remainingHours === 'number'
      ? result.duration.remainingHours
      : Math.max(0, totalHours - fullDays * 24);

  return {
    isForeign: false,
    duration: {
      totalHours,
      fullDays,
      remainingHours,
    },
    diet: {
      rateUsed: result.diet?.rateUsed ?? null,
      days: result.diet?.days ?? [],
      total: result.diet?.total ?? 0,
    },
    accommodation: {
      nights: result.accommodation?.nights ?? [],
      total: result.accommodation?.total ?? 0,
    },
    transport: {
      type: result.transport?.type ?? 'COMPANY_VEHICLE',
      mileage: result.transport?.mileage ?? null,
      receipts: result.transport?.receipts ?? [],
      localTransportLumpSum: result.transport?.localTransportLumpSum ?? 0,
      total: result.transport?.total ?? 0,
    },
    additionalCosts: {
      items: result.additionalCosts?.items ?? [],
      total: result.additionalCosts?.total ?? 0,
    },
    summary: {
      dietTotal: result.summary?.dietTotal ?? 0,
      accommodationTotal: result.summary?.accommodationTotal ?? 0,
      transportTotal: result.summary?.transportTotal ?? 0,
      additionalTotal: result.summary?.additionalTotal ?? 0,
      grandTotal: result.summary?.grandTotal ?? 0,
      advanceAmount: result.summary?.advanceAmount ?? 0,
      amountDue: result.summary?.amountDue ?? 0,
    },
  };
}
