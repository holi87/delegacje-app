import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { initSetup } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Building2,
  UserCog,
  Settings,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Schemas ---

const companySchema = z.object({
  name: z.string().min(1, 'Nazwa firmy jest wymagana'),
  nip: z
    .string()
    .min(10, 'NIP musi miec 10 cyfr')
    .max(10, 'NIP musi miec 10 cyfr')
    .regex(/^\d{10}$/, 'NIP musi skladac sie z 10 cyfr'),
  address: z.string().min(1, 'Adres jest wymagany'),
  postalCode: z
    .string()
    .min(1, 'Kod pocztowy jest wymagany')
    .regex(/^\d{2}-\d{3}$/, 'Format kodu: XX-XXX'),
  city: z.string().min(1, 'Miasto jest wymagane'),
});

const adminSchema = z
  .object({
    email: z.string().min(1, 'E-mail jest wymagany').email('Nieprawidlowy e-mail'),
    password: z.string().min(8, 'Haslo musi miec minimum 8 znakow'),
    confirmPassword: z.string().min(1, 'Potwierdz haslo'),
    firstName: z.string().min(1, 'Imie jest wymagane'),
    lastName: z.string().min(1, 'Nazwisko jest wymagane'),
    position: z.string().min(1, 'Stanowisko jest wymagane'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Hasla nie sa identyczne',
    path: ['confirmPassword'],
  });

type CompanyFormData = z.infer<typeof companySchema>;
type AdminFormData = z.infer<typeof adminSchema>;

// --- Step indicator ---

const steps = [
  { label: 'Firma', icon: Building2 },
  { label: 'Administrator', icon: UserCog },
  { label: 'Stawki', icon: Settings },
  { label: 'Podsumowanie', icon: CheckCircle2 },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8 flex items-center justify-center">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <div key={step.label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                  isActive && 'border-primary bg-primary text-primary-foreground',
                  isCompleted && 'border-primary bg-primary/10 text-primary',
                  !isActive && !isCompleted && 'border-muted-foreground/30 text-muted-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={cn(
                  'mt-1 text-xs font-medium',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-0.5 w-12 sm:w-16',
                  index < currentStep ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Step 1: Company ---

function StepCompany({
  onNext,
  defaultValues,
}: {
  onNext: (data: CompanyFormData) => void;
  defaultValues?: CompanyFormData;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4">
      <h2 className="text-xl font-semibold">Dane firmy</h2>
      <p className="text-sm text-muted-foreground">
        Wprowadz dane spolki, ktore pojawia sie na dokumentach delegacji.
      </p>

      <div className="space-y-2">
        <Label htmlFor="name">Nazwa firmy</Label>
        <Input id="name" placeholder="Przykladowa Sp. z o.o." {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="nip">NIP</Label>
        <Input id="nip" placeholder="1234567890" maxLength={10} {...register('nip')} />
        {errors.nip && <p className="text-sm text-destructive">{errors.nip.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Adres</Label>
        <Input id="address" placeholder="ul. Przykladowa 1" {...register('address')} />
        {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="postalCode">Kod pocztowy</Label>
          <Input id="postalCode" placeholder="00-001" {...register('postalCode')} />
          {errors.postalCode && (
            <p className="text-sm text-destructive">{errors.postalCode.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Miasto</Label>
          <Input id="city" placeholder="Warszawa" {...register('city')} />
          {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit">
          Dalej
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

// --- Step 2: Admin ---

function StepAdmin({
  onNext,
  onBack,
  defaultValues,
}: {
  onNext: (data: AdminFormData) => void;
  onBack: () => void;
  defaultValues?: AdminFormData;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminFormData>({
    resolver: zodResolver(adminSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4">
      <h2 className="text-xl font-semibold">Konto administratora</h2>
      <p className="text-sm text-muted-foreground">
        Utworz konto administratora systemu.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Imie</Label>
          <Input id="firstName" placeholder="Jan" {...register('firstName')} />
          {errors.firstName && (
            <p className="text-sm text-destructive">{errors.firstName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Nazwisko</Label>
          <Input id="lastName" placeholder="Kowalski" {...register('lastName')} />
          {errors.lastName && (
            <p className="text-sm text-destructive">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="position">Stanowisko</Label>
        <Input id="position" placeholder="Administrator" {...register('position')} />
        {errors.position && (
          <p className="text-sm text-destructive">{errors.position.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-email">Adres e-mail</Label>
        <Input
          id="admin-email"
          type="email"
          placeholder="admin@firma.pl"
          {...register('email')}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-password">Haslo</Label>
        <Input
          id="admin-password"
          type="password"
          placeholder="Minimum 8 znakow"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Potwierdz haslo</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Powtorz haslo"
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Wstecz
        </Button>
        <Button type="submit">
          Dalej
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

// --- Step 3: Rates ---

function StepRates({
  onNext,
  onBack,
  accepted,
  setAccepted,
}: {
  onNext: () => void;
  onBack: () => void;
  accepted: boolean;
  setAccepted: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Stawki domyslne</h2>
      <p className="text-sm text-muted-foreground">
        System zostanie skonfigurowany z domyslnymi stawkami zgodnymi z Rozporzadzeniem MPiPS
        (Dz.U. 2022 poz. 2302). Mozesz je zmienic pozniej w panelu administracyjnym.
      </p>

      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Stawki krajowe</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Dieta pelna (doba):</span>
          <span className="font-medium">45,00 zl</span>
          <span className="text-muted-foreground">Ryczalt za nocleg:</span>
          <span className="font-medium">67,50 zl</span>
          <span className="text-muted-foreground">Ryczalt za dojazdy:</span>
          <span className="font-medium">9,00 zl</span>
        </div>

        <h3 className="mt-4 font-medium">Stawki kilometrowki</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Samochod pow. 900 cm3:</span>
          <span className="font-medium">1,15 zl/km</span>
          <span className="text-muted-foreground">Samochod do 900 cm3:</span>
          <span className="font-medium">0,89 zl/km</span>
          <span className="text-muted-foreground">Motocykl:</span>
          <span className="font-medium">0,69 zl/km</span>
          <span className="text-muted-foreground">Motorower:</span>
          <span className="font-medium">0,42 zl/km</span>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-input"
        />
        <span className="text-sm">
          Akceptuje ustawienie domyslnych stawek. Moge je zmienic pozniej w panelu
          administracyjnym.
        </span>
      </label>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Wstecz
        </Button>
        <Button onClick={onNext} disabled={!accepted}>
          Dalej
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// --- Step 4: Summary ---

function StepSummary({
  companyData,
  adminData,
  onBack,
  onConfirm,
  isSubmitting,
}: {
  companyData: CompanyFormData;
  adminData: AdminFormData;
  onBack: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Podsumowanie</h2>
      <p className="text-sm text-muted-foreground">
        Sprawdz dane i potwierdz konfiguracje systemu.
      </p>

      <div className="space-y-4">
        <div className="rounded-lg border p-4">
          <h3 className="mb-2 font-medium">Dane firmy</h3>
          <div className="grid grid-cols-2 gap-1 text-sm">
            <span className="text-muted-foreground">Nazwa:</span>
            <span>{companyData.name}</span>
            <span className="text-muted-foreground">NIP:</span>
            <span>{companyData.nip}</span>
            <span className="text-muted-foreground">Adres:</span>
            <span>{companyData.address}</span>
            <span className="text-muted-foreground">Kod pocztowy:</span>
            <span>{companyData.postalCode}</span>
            <span className="text-muted-foreground">Miasto:</span>
            <span>{companyData.city}</span>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="mb-2 font-medium">Administrator</h3>
          <div className="grid grid-cols-2 gap-1 text-sm">
            <span className="text-muted-foreground">Imie i nazwisko:</span>
            <span>
              {adminData.firstName} {adminData.lastName}
            </span>
            <span className="text-muted-foreground">E-mail:</span>
            <span>{adminData.email}</span>
            <span className="text-muted-foreground">Stanowisko:</span>
            <span>{adminData.position}</span>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="mb-2 font-medium">Stawki</h3>
          <p className="text-sm text-muted-foreground">
            Domyslne stawki zgodne z Rozporzadzeniem MPiPS (Dz.U. 2022 poz. 2302)
          </p>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Wstecz
        </Button>
        <Button onClick={onConfirm} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Potwierdz i utworz
        </Button>
      </div>
    </div>
  );
}

// --- Main Setup Wizard ---

export default function SetupWizardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyData, setCompanyData] = useState<CompanyFormData>();
  const [adminData, setAdminData] = useState<AdminFormData>();
  const [ratesAccepted, setRatesAccepted] = useState(false);

  const handleCompanyNext = (data: CompanyFormData) => {
    setCompanyData(data);
    setStep(1);
  };

  const handleAdminNext = (data: AdminFormData) => {
    setAdminData(data);
    setStep(2);
  };

  const handleRatesNext = () => {
    setStep(3);
  };

  const handleConfirm = async () => {
    if (!companyData || !adminData) return;

    setIsSubmitting(true);
    try {
      await initSetup({
        company: companyData,
        admin: {
          email: adminData.email,
          password: adminData.password,
          firstName: adminData.firstName,
          lastName: adminData.lastName,
          position: adminData.position,
        },
        rates: { useDefaults: true },
      });

      toast.success('System skonfigurowany pomyslnie! Mozesz sie teraz zalogowac.');
      await queryClient.invalidateQueries({ queryKey: ['setup-status'] });
      navigate('/login', { replace: true });
    } catch (error: any) {
      const message =
        error.response?.data?.message || 'Wystapil blad podczas konfiguracji';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <div className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Konfiguracja systemu</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Skonfiguruj system delegacji w kilku krokach
          </p>
        </div>

        <StepIndicator currentStep={step} />

        {step === 0 && (
          <StepCompany onNext={handleCompanyNext} defaultValues={companyData} />
        )}
        {step === 1 && (
          <StepAdmin
            onNext={handleAdminNext}
            onBack={() => setStep(0)}
            defaultValues={adminData}
          />
        )}
        {step === 2 && (
          <StepRates
            onNext={handleRatesNext}
            onBack={() => setStep(1)}
            accepted={ratesAccepted}
            setAccepted={setRatesAccepted}
          />
        )}
        {step === 3 && companyData && adminData && (
          <StepSummary
            companyData={companyData}
            adminData={adminData}
            onBack={() => setStep(2)}
            onConfirm={handleConfirm}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
