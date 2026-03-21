import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile, changePassword } from '@/api/profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { useEffect } from 'react';

// --- Schemas ---

const profileSchema = z.object({
  firstName: z.string().min(1, 'Imie jest wymagane'),
  lastName: z.string().min(1, 'Nazwisko jest wymagane'),
  position: z.string().min(1, 'Stanowisko jest wymagane'),
  defaultVehicle: z.string().optional(),
  vehiclePlate: z.string().optional(),
  vehicleCapacity: z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Aktualne haslo jest wymagane'),
    newPassword: z.string().min(8, 'Nowe haslo musi miec minimum 8 znakow'),
    confirmPassword: z.string().min(1, 'Potwierdz nowe haslo'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Hasla nie sa identyczne',
    path: ['confirmPassword'],
  });

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  // --- Profile form ---

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (profile) {
      profileForm.reset({
        firstName: profile.firstName,
        lastName: profile.lastName,
        position: profile.position,
        defaultVehicle: profile.defaultVehicle ?? '',
        vehiclePlate: profile.vehiclePlate ?? '',
        vehicleCapacity: profile.vehicleCapacity ?? '',
      });
    }
  }, [profile, profileForm]);

  const updateProfileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profil zaktualizowany');
    },
    onError: () => {
      toast.error('Nie udalo sie zaktualizowac profilu');
    },
  });

  const onProfileSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate({
      firstName: data.firstName,
      lastName: data.lastName,
      position: data.position,
      defaultVehicle: data.defaultVehicle || null,
      vehiclePlate: data.vehiclePlate || null,
      vehicleCapacity: data.vehicleCapacity || null,
    });
  };

  // --- Password form ---

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const changePasswordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      passwordForm.reset();
      toast.success('Haslo zostalo zmienione');
    },
    onError: (error: any) => {
      const message =
        error.response?.data?.message || 'Nie udalo sie zmienic hasla';
      toast.error(message);
    },
  });

  const onPasswordSubmit = (data: PasswordFormData) => {
    changePasswordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold">Moj profil</h1>

      {/* Profile info section */}
      <div className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">Dane osobowe</h2>
        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profile-firstName">Imie</Label>
              <Input id="profile-firstName" {...profileForm.register('firstName')} />
              {profileForm.formState.errors.firstName && (
                <p className="text-sm text-destructive">
                  {profileForm.formState.errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-lastName">Nazwisko</Label>
              <Input id="profile-lastName" {...profileForm.register('lastName')} />
              {profileForm.formState.errors.lastName && (
                <p className="text-sm text-destructive">
                  {profileForm.formState.errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-position">Stanowisko</Label>
            <Input id="profile-position" {...profileForm.register('position')} />
            {profileForm.formState.errors.position && (
              <p className="text-sm text-destructive">
                {profileForm.formState.errors.position.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profile-defaultVehicle">Pojazd domyslny</Label>
              <Input
                id="profile-defaultVehicle"
                placeholder="np. Samochod osobowy"
                {...profileForm.register('defaultVehicle')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-vehiclePlate">Nr rejestracyjny</Label>
              <Input
                id="profile-vehiclePlate"
                placeholder="np. WA 12345"
                {...profileForm.register('vehiclePlate')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-vehicleCapacity">Pojemnosc silnika (cm3)</Label>
              <Input
                id="profile-vehicleCapacity"
                placeholder="np. 1598"
                {...profileForm.register('vehicleCapacity')}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Zapisz zmiany
            </Button>
          </div>
        </form>
      </div>

      {/* Password change section */}
      <div className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">Zmiana hasla</h2>
        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Aktualne haslo</Label>
            <Input
              id="currentPassword"
              type="password"
              {...passwordForm.register('currentPassword')}
            />
            {passwordForm.formState.errors.currentPassword && (
              <p className="text-sm text-destructive">
                {passwordForm.formState.errors.currentPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Nowe haslo</Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="Minimum 8 znakow"
              {...passwordForm.register('newPassword')}
            />
            {passwordForm.formState.errors.newPassword && (
              <p className="text-sm text-destructive">
                {passwordForm.formState.errors.newPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-confirmPassword">Potwierdz nowe haslo</Label>
            <Input
              id="profile-confirmPassword"
              type="password"
              {...passwordForm.register('confirmPassword')}
            />
            {passwordForm.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {passwordForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Zmien haslo
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
