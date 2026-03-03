import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCompanyInfo,
  updateCompanyInfo,
  getDelegationNumbering,
  updateDelegationNumbering,
} from '@/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import type { CompanyInfo, DelegationNumberingSettings } from '../../../../shared/types';

// --- Schema ---

const companySchema = z.object({
  name: z.string().min(1, 'Nazwa firmy jest wymagana'),
  nip: z
    .string()
    .min(1, 'NIP jest wymagany')
    .regex(/^\d{10}$/, 'NIP musi skladac sie z 10 cyfr'),
  address: z.string().min(1, 'Adres jest wymagany'),
  postalCode: z
    .string()
    .min(1, 'Kod pocztowy jest wymagany')
    .regex(/^\d{2}-\d{3}$/, 'Format kodu pocztowego: XX-XXX'),
  city: z.string().min(1, 'Miasto jest wymagane'),
});

type CompanyFormData = z.infer<typeof companySchema>;

const delegationNumberingSchema = z.object({
  nextNumber: z.coerce
    .number()
    .int('Numer musi byc liczba calkowita')
    .min(1, 'Numer musi byc wiekszy od 0'),
});

type DelegationNumberingFormData = z.infer<typeof delegationNumberingSchema>;

// --- Component ---

export default function AdminCompanyPage() {
  const queryClient = useQueryClient();

  const { data: companyData, isLoading } = useQuery({
    queryKey: ['admin', 'company'],
    queryFn: getCompanyInfo,
  });
  const { data: delegationNumberingData, isLoading: isNumberingLoading } = useQuery({
    queryKey: ['admin', 'delegation-numbering'],
    queryFn: getDelegationNumbering,
  });

  const company: CompanyInfo | null = companyData ?? null;
  const delegationNumbering: DelegationNumberingSettings | null =
    delegationNumberingData ?? null;

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      nip: '',
      address: '',
      postalCode: '',
      city: '',
    },
  });

  const delegationNumberingForm = useForm<DelegationNumberingFormData>({
    resolver: zodResolver(delegationNumberingSchema),
    defaultValues: {
      nextNumber: 1,
    },
  });

  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name,
        nip: company.nip,
        address: company.address,
        postalCode: company.postalCode,
        city: company.city,
      });
    }
  }, [company, form]);

  useEffect(() => {
    if (delegationNumbering) {
      delegationNumberingForm.reset({
        nextNumber: delegationNumbering.nextNumber,
      });
    }
  }, [delegationNumbering, delegationNumberingForm]);

  const updateMutation = useMutation({
    mutationFn: (data: CompanyFormData) => updateCompanyInfo(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'company'] });
      toast.success('Dane firmy zostaly zaktualizowane');
    },
    onError: () => {
      toast.error('Nie udalo sie zaktualizowac danych firmy');
    },
  });

  const updateDelegationNumberingMutation = useMutation({
    mutationFn: (data: DelegationNumberingFormData) =>
      updateDelegationNumbering(data.nextNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'delegation-numbering'] });
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      toast.success('Numeracja delegacji zostala zaktualizowana');
    },
    onError: () => {
      toast.error('Nie udalo sie zaktualizowac numeracji delegacji');
    },
  });

  function onSubmit(data: CompanyFormData) {
    updateMutation.mutate(data);
  }

  function onDelegationNumberingSubmit(data: DelegationNumberingFormData) {
    updateDelegationNumberingMutation.mutate(data);
  }

  if (isLoading || isNumberingLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Dane firmy</h1>

      <Card>
        <CardHeader>
          <CardTitle>Informacje o firmie</CardTitle>
          <CardDescription>
            Dane firmy wyswietlane na dokumentach i rozliczeniach delegacji.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Nazwa firmy</Label>
              <Input
                id="company-name"
                placeholder="Nazwa spolki z o.o."
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-nip">NIP</Label>
              <Input
                id="company-nip"
                placeholder="1234567890"
                maxLength={10}
                {...form.register('nip')}
              />
              {form.formState.errors.nip && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.nip.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-address">Adres</Label>
              <Input
                id="company-address"
                placeholder="ul. Przykladowa 1/2"
                {...form.register('address')}
              />
              {form.formState.errors.address && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.address.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company-postalCode">Kod pocztowy</Label>
                <Input
                  id="company-postalCode"
                  placeholder="00-000"
                  maxLength={6}
                  {...form.register('postalCode')}
                />
                {form.formState.errors.postalCode && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.postalCode.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-city">Miasto</Label>
                <Input
                  id="company-city"
                  placeholder="Warszawa"
                  {...form.register('city')}
                />
                {form.formState.errors.city && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.city.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Zapisz zmiany
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Numeracja delegacji</CardTitle>
          <CardDescription>
            Ustaw kolejny numer delegacji (przydatne np. w testach).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={delegationNumberingForm.handleSubmit(onDelegationNumberingSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="delegation-nextNumber">Nastepny numer</Label>
              <Input
                id="delegation-nextNumber"
                type="number"
                min={1}
                step={1}
                {...delegationNumberingForm.register('nextNumber', {
                  valueAsNumber: true,
                })}
              />
              {delegationNumberingForm.formState.errors.nextNumber && (
                <p className="text-sm text-destructive">
                  {delegationNumberingForm.formState.errors.nextNumber.message}
                </p>
              )}
            </div>

            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              Nastepny numer w systemie:{' '}
              <span className="font-semibold">
                {delegationNumbering?.previewNumber ?? '---'}
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={updateDelegationNumberingMutation.isPending}
              >
                {updateDelegationNumberingMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Zapisz numeracje
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
