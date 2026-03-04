import { useState, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Save,
  SendHorizonal,
  Check,
  Loader2,
} from 'lucide-react';
import { StepBasicInfo } from './StepBasicInfo';
import { StepTransport } from './StepTransport';
import { StepAccommodation } from './StepAccommodation';
import { StepMeals } from './StepMeals';
import { StepAdditionalCosts } from './StepAdditionalCosts';
import { StepAdvance } from './StepAdvance';
import { StepSummary } from './StepSummary';
import type { ApiCalculationResult } from '@/utils/calculation';

// ---------- Zod schema ----------

const transportReceiptSchema = z.object({
  description: z.string().min(1, 'Opis jest wymagany'),
  amount: z.string().min(1, 'Kwota jest wymagana'),
  receiptNumber: z
    .string()
    .trim()
    .min(1, 'Numer dokumentu ksiegowego jest wymagany'),
});

const additionalCostSchema = z.object({
  category: z.string().min(1, 'Kategoria jest wymagana'),
  description: z.string().min(1, 'Opis jest wymagany'),
  amount: z.string().min(1, 'Kwota jest wymagana'),
  receiptNumber: z
    .string()
    .trim()
    .min(1, 'Numer dokumentu ksiegowego jest wymagany'),
});

const delegationDaySchema = z.object({
  dayNumber: z.number(),
  date: z.string(),
  breakfastProvided: z.boolean(),
  lunchProvided: z.boolean(),
  dinnerProvided: z.boolean(),
  accommodationType: z.enum(['RECEIPT', 'LUMP_SUM', 'FREE', 'NONE']),
  accommodationCost: z.string().nullable().optional(),
  accommodationReceiptNumber: z.string().nullable().optional(),
  isForeign: z.boolean().default(false),
});

const mileageDetailsSchema = z.object({
  vehicleType: z.enum(['CAR_ABOVE_900', 'CAR_BELOW_900', 'MOTORCYCLE', 'MOPED']),
  vehiclePlate: z.string().min(1, 'Nr rejestracyjny jest wymagany'),
  distanceKm: z.number().min(1, 'Dystans musi byc wiekszy niz 0'),
});

export const delegationFormSchema = z
  .object({
    proposedNumber: z
      .string()
      .trim()
      .max(64, 'Numer delegacji moze miec maksymalnie 64 znaki')
      .regex(/^[A-Za-z0-9/_\-.]*$/, 'Numer delegacji zawiera niedozwolone znaki')
      .nullable()
      .optional(),
    purpose: z.string().min(1, 'Cel delegacji jest wymagany'),
    destination: z.string().min(1, 'Miejsce delegacji jest wymagane'),
    departureAt: z.string().min(1, 'Data wyjazdu jest wymagana'),
    returnAt: z.string().min(1, 'Data powrotu jest wymagana'),
    type: z.enum(['DOMESTIC', 'FOREIGN']).default('DOMESTIC'),
    foreignCountry: z.string().nullable().optional(),
    borderCrossingOut: z.string().nullable().optional(),
    borderCrossingIn: z.string().nullable().optional(),
    transportType: z.enum([
      'COMPANY_VEHICLE',
      'PUBLIC_TRANSPORT',
      'PRIVATE_VEHICLE',
      'MIXED',
    ]),
    accommodationType: z.enum(['RECEIPT', 'LUMP_SUM', 'FREE', 'NONE']),
    advanceAmount: z.string().default('0'),
    days: z.array(delegationDaySchema),
    mileageDetails: mileageDetailsSchema.nullable().optional(),
    transportReceipts: z.array(transportReceiptSchema),
    additionalCosts: z.array(additionalCostSchema),
  })
  .refine(
    (data) => {
      if (!data.departureAt || !data.returnAt) return true;
      return new Date(data.returnAt) > new Date(data.departureAt);
    },
    {
      message: 'Data powrotu musi byc pozniejsza niz data wyjazdu',
      path: ['returnAt'],
    }
  )
  .refine(
    (data) => {
      if (
        data.transportType === 'PRIVATE_VEHICLE' ||
        data.transportType === 'MIXED'
      ) {
        return !!data.mileageDetails;
      }
      return true;
    },
    {
      message: 'Dane pojazdu sa wymagane dla tego typu transportu',
      path: ['mileageDetails'],
    }
  )
  .refine(
    (data) => {
      if (data.type === 'FOREIGN') {
        return !!data.foreignCountry && !!data.borderCrossingOut && !!data.borderCrossingIn;
      }
      return true;
    },
    {
      message: 'Dla delegacji zagranicznej wymagane sa: kraj, czas przekroczenia granicy',
      path: ['foreignCountry'],
    }
  )
  .superRefine((data, ctx) => {
    data.days.forEach((day, index) => {
      if (day.accommodationType !== 'RECEIPT') return;

      const hasAmount =
        day.accommodationCost != null && String(day.accommodationCost).trim() !== '';
      if (!hasAmount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['days', index, 'accommodationCost'],
          message: 'Kwota noclegu wg rachunku jest wymagana',
        });
      }

      const hasReceiptNumber =
        day.accommodationReceiptNumber != null &&
        String(day.accommodationReceiptNumber).trim() !== '';
      if (!hasReceiptNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['days', index, 'accommodationReceiptNumber'],
          message: 'Numer dokumentu ksiegowego jest wymagany',
        });
      }
    });
  });

export type DelegationFormValues = z.infer<typeof delegationFormSchema>;

// ---------- Step config ----------

const STEPS = [
  { number: 1, label: 'Dane podstawowe', shortLabel: 'Podstawowe' },
  { number: 2, label: 'Transport', shortLabel: 'Transport' },
  { number: 3, label: 'Noclegi', shortLabel: 'Noclegi' },
  { number: 4, label: 'Posilki', shortLabel: 'Posilki' },
  { number: 5, label: 'Koszty dodatkowe', shortLabel: 'Koszty' },
  { number: 6, label: 'Zaliczka', shortLabel: 'Zaliczka' },
  { number: 7, label: 'Podsumowanie', shortLabel: 'Podsumowanie' },
] as const;

// Fields to validate per step (partial validation on Next)
const STEP_FIELDS: Record<number, (keyof DelegationFormValues)[]> = {
  1: ['proposedNumber', 'purpose', 'destination', 'departureAt', 'returnAt', 'type'],
  2: ['transportType', 'mileageDetails', 'transportReceipts'],
  3: ['accommodationType', 'days'],
  4: ['days'],
  5: ['additionalCosts'],
  6: ['advanceAmount'],
  7: [],
};

// ---------- Props ----------

interface DelegationWizardProps {
  /** Initial form values when editing an existing delegation */
  initialValues?: Partial<DelegationFormValues>;
  /** Existing delegation id (for editing) */
  delegationId?: string;
  /** Resolve draft delegation id (used in new flow to avoid duplicate creates) */
  ensureDelegationId?: (data: DelegationFormValues) => Promise<string>;
  /** Called when user saves as draft */
  onSaveDraft: (data: DelegationFormValues) => Promise<void>;
  /** Called when user submits the delegation */
  onSubmit: (data: DelegationFormValues) => Promise<void>;
  /** Loading state for save operations */
  isSaving?: boolean;
}

export function DelegationWizard({
  initialValues,
  delegationId,
  ensureDelegationId,
  onSaveDraft,
  onSubmit,
  isSaving = false,
}: DelegationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [calculationResult, setCalculationResult] =
    useState<ApiCalculationResult | null>(null);

  const methods = useForm<DelegationFormValues>({
    resolver: zodResolver(delegationFormSchema),
    defaultValues: {
      proposedNumber: null,
      purpose: '',
      destination: '',
      departureAt: '',
      returnAt: '',
      type: 'DOMESTIC' as const,
      foreignCountry: null,
      borderCrossingOut: null,
      borderCrossingIn: null,
      transportType: 'COMPANY_VEHICLE',
      accommodationType: 'NONE',
      advanceAmount: '0',
      days: [],
      mileageDetails: null,
      transportReceipts: [],
      additionalCosts: [],
      ...initialValues,
    },
    mode: 'onBlur',
  });

  const { trigger, getValues } = methods;

  // Validate current step's fields before moving forward
  const validateCurrentStep = useCallback(async () => {
    const fields = STEP_FIELDS[currentStep];
    if (!fields || fields.length === 0) return true;
    const result = await trigger(fields);
    return result;
  }, [currentStep, trigger]);

  const goNext = useCallback(async () => {
    const valid = await validateCurrentStep();
    if (valid && currentStep < 7) {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep, validateCurrentStep]);

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback(
    async (step: number) => {
      // Allow going back freely, forward only with validation
      if (step < currentStep) {
        setCurrentStep(step);
      } else if (step > currentStep) {
        const valid = await validateCurrentStep();
        if (valid) {
          setCurrentStep(step);
        }
      }
    },
    [currentStep, validateCurrentStep]
  );

  const handleSaveDraft = useCallback(async () => {
    const data = getValues();
    await onSaveDraft(data);
  }, [getValues, onSaveDraft]);

  const handleSubmit = useCallback(async () => {
    const valid = await trigger();
    if (!valid) return;
    const data = getValues();
    await onSubmit(data);
  }, [trigger, getValues, onSubmit]);

  // ---------- Render ----------

  return (
    <FormProvider {...methods}>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Step indicator */}
        <nav aria-label="Kroki formularza">
          <ol className="flex items-center gap-1">
            {STEPS.map((step, idx) => {
              const isActive = step.number === currentStep;
              const isCompleted = step.number < currentStep;

              return (
                <li key={step.number} className="flex flex-1 items-center">
                  <button
                    type="button"
                    onClick={() => goToStep(step.number)}
                    className={cn(
                      'flex w-full flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs transition-colors',
                      isActive && 'bg-primary/10 text-primary',
                      isCompleted && 'text-primary cursor-pointer',
                      !isActive && !isCompleted && 'text-muted-foreground'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold',
                        isActive && 'border-primary bg-primary text-primary-foreground',
                        isCompleted &&
                          'border-primary bg-primary/10 text-primary',
                        !isActive &&
                          !isCompleted &&
                          'border-muted-foreground/30 text-muted-foreground'
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        step.number
                      )}
                    </span>
                    <span className="hidden font-medium sm:inline">
                      {step.shortLabel}
                    </span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'hidden h-0.5 w-full sm:block',
                        isCompleted ? 'bg-primary' : 'bg-muted'
                      )}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Step content */}
        <Card>
          <CardContent className="pt-6">
            {currentStep === 1 && <StepBasicInfo />}
            {currentStep === 2 && <StepTransport />}
            {currentStep === 3 && <StepAccommodation />}
            {currentStep === 4 && <StepMeals />}
            {currentStep === 5 && <StepAdditionalCosts />}
            {currentStep === 6 && <StepAdvance />}
            {currentStep === 7 && (
              <StepSummary
                delegationId={delegationId}
                ensureDelegationId={ensureDelegationId}
                calculationResult={calculationResult}
                onCalculationResult={setCalculationResult}
              />
            )}
          </CardContent>
        </Card>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={isSaving}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Wstecz
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              Zapisz szkic
            </Button>

            {currentStep < 7 ? (
              <Button type="button" onClick={goNext} disabled={isSaving}>
                Dalej
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizonal className="mr-1 h-4 w-4" />
                )}
                Zloz delegacje
              </Button>
            )}
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
