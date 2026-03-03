import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listUsers, createUser, updateUser, deactivateUser } from '@/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Loader2, Plus, MoreHorizontal, Pencil, UserX } from 'lucide-react';
import type { User, Role } from '../../../../shared/types';

// --- Constants ---

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  DELEGATED: 'Delegowany',
};

// --- Schemas ---

const createUserSchema = z.object({
  email: z.string().email('Nieprawidlowy adres email'),
  password: z.string().min(8, 'Haslo musi miec minimum 8 znakow'),
  firstName: z.string().min(1, 'Imie jest wymagane'),
  lastName: z.string().min(1, 'Nazwisko jest wymagane'),
  position: z.string().min(1, 'Stanowisko jest wymagane'),
  role: z.enum(['ADMIN', 'DELEGATED'], {
    required_error: 'Rola jest wymagana',
  }),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

const editUserSchema = z.object({
  email: z.string().email('Nieprawidlowy adres email'),
  firstName: z.string().min(1, 'Imie jest wymagane'),
  lastName: z.string().min(1, 'Nazwisko jest wymagane'),
  position: z.string().min(1, 'Stanowisko jest wymagane'),
  role: z.enum(['ADMIN', 'DELEGATED'], {
    required_error: 'Rola jest wymagana',
  }),
});

type EditUserFormData = z.infer<typeof editUserSchema>;

// --- Component ---

export default function AdminUsersPage() {
  const queryClient = useQueryClient();

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);

  // --- Query ---

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => listUsers(),
  });

  const users: User[] = usersData?.users ?? usersData ?? [];

  // --- Create user ---

  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      position: '',
      role: 'DELEGATED',
    },
  });

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Uzytkownik zostal utworzony');
      closeCreateDialog();
    },
    onError: (error: any) => {
      const message =
        error.response?.data?.message || 'Nie udalo sie utworzyc uzytkownika';
      toast.error(message);
    },
  });

  function openCreateDialog() {
    createForm.reset({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      position: '',
      role: 'DELEGATED',
    });
    setCreateDialogOpen(true);
  }

  function closeCreateDialog() {
    setCreateDialogOpen(false);
    createForm.reset();
  }

  function onCreateSubmit(data: CreateUserFormData) {
    createUserMutation.mutate(data);
  }

  // --- Edit user ---

  const editForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditUserFormData }) =>
      updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Uzytkownik zostal zaktualizowany');
      closeEditDialog();
    },
    onError: (error: any) => {
      const message =
        error.response?.data?.message || 'Nie udalo sie zaktualizowac uzytkownika';
      toast.error(message);
    },
  });

  function openEditDialog(user: User) {
    setEditingUser(user);
    editForm.reset({
      email: user.email,
      firstName: user.profile?.firstName ?? '',
      lastName: user.profile?.lastName ?? '',
      position: user.profile?.position ?? '',
      role: user.role,
    });
    setEditDialogOpen(true);
  }

  function closeEditDialog() {
    setEditDialogOpen(false);
    setEditingUser(null);
    editForm.reset();
  }

  function onEditSubmit(data: EditUserFormData) {
    if (!editingUser) return;
    updateUserMutation.mutate({ id: editingUser.id, data });
  }

  // --- Deactivate user ---

  const deactivateUserMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Uzytkownik zostal dezaktywowany');
      setDeactivateDialogOpen(false);
      setDeactivatingUser(null);
    },
    onError: () => {
      toast.error('Nie udalo sie dezaktywowac uzytkownika');
    },
  });

  function openDeactivateDialog(user: User) {
    setDeactivatingUser(user);
    setDeactivateDialogOpen(true);
  }

  function confirmDeactivate() {
    if (!deactivatingUser) return;
    deactivateUserMutation.mutate(deactivatingUser.id);
  }

  // --- Helpers ---

  function getUserDisplayName(user: User): string {
    if (user.profile) {
      return `${user.profile.firstName} ${user.profile.lastName}`;
    }
    return user.email;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zarzadzanie uzytkownikami</h1>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Dodaj uzytkownika
        </Button>
      </div>

      {/* Users table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Brak uzytkownikow w systemie.
        </p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Imie i nazwisko</TableHead>
                <TableHead>Stanowisko</TableHead>
                <TableHead>Rola</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[70px]">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user: User) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{getUserDisplayName(user)}</TableCell>
                  <TableCell>{user.profile?.position ?? '---'}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Aktywny
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                        Nieaktywny
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(user)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edytuj
                        </DropdownMenuItem>
                        {user.isActive && (
                          <DropdownMenuItem
                            onClick={() => openDeactivateDialog(user)}
                            className="text-destructive focus:text-destructive"
                          >
                            <UserX className="mr-2 h-4 w-4" />
                            Dezaktywuj
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create user dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nowy uzytkownik</DialogTitle>
            <DialogDescription>
              Utworz nowe konto uzytkownika w systemie.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={createForm.handleSubmit(onCreateSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="cu-email">Email</Label>
              <Input
                id="cu-email"
                type="email"
                placeholder="jan@firma.pl"
                {...createForm.register('email')}
              />
              {createForm.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cu-password">Haslo</Label>
              <Input
                id="cu-password"
                type="password"
                placeholder="Minimum 8 znakow"
                {...createForm.register('password')}
              />
              {createForm.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cu-firstName">Imie</Label>
                <Input
                  id="cu-firstName"
                  placeholder="Jan"
                  {...createForm.register('firstName')}
                />
                {createForm.formState.errors.firstName && (
                  <p className="text-sm text-destructive">
                    {createForm.formState.errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cu-lastName">Nazwisko</Label>
                <Input
                  id="cu-lastName"
                  placeholder="Kowalski"
                  {...createForm.register('lastName')}
                />
                {createForm.formState.errors.lastName && (
                  <p className="text-sm text-destructive">
                    {createForm.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cu-position">Stanowisko</Label>
              <Input
                id="cu-position"
                placeholder="np. Czlonek zarzadu"
                {...createForm.register('position')}
              />
              {createForm.formState.errors.position && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.position.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Rola</Label>
              <Select
                value={createForm.watch('role')}
                onValueChange={(value) =>
                  createForm.setValue('role', value as Role)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="DELEGATED">Delegowany</SelectItem>
                </SelectContent>
              </Select>
              {createForm.formState.errors.role && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.role.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeCreateDialog}
              >
                Anuluj
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Utworz uzytkownika
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj uzytkownika</DialogTitle>
            <DialogDescription>
              Zmien dane uzytkownika {editingUser?.email}.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={editForm.handleSubmit(onEditSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="eu-email">Email</Label>
              <Input
                id="eu-email"
                type="email"
                {...editForm.register('email')}
              />
              {editForm.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {editForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eu-firstName">Imie</Label>
                <Input
                  id="eu-firstName"
                  {...editForm.register('firstName')}
                />
                {editForm.formState.errors.firstName && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="eu-lastName">Nazwisko</Label>
                <Input
                  id="eu-lastName"
                  {...editForm.register('lastName')}
                />
                {editForm.formState.errors.lastName && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="eu-position">Stanowisko</Label>
              <Input
                id="eu-position"
                {...editForm.register('position')}
              />
              {editForm.formState.errors.position && (
                <p className="text-sm text-destructive">
                  {editForm.formState.errors.position.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Rola</Label>
              <Select
                value={editForm.watch('role')}
                onValueChange={(value) =>
                  editForm.setValue('role', value as Role)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="DELEGATED">Delegowany</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeEditDialog}
              >
                Anuluj
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Zapisz zmiany
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deactivate confirmation dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dezaktywacja uzytkownika</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz dezaktywowac uzytkownika{' '}
              <strong>{deactivatingUser?.email}</strong>? Uzytkownik nie bedzie
              mogl sie logowac do systemu.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeactivateDialogOpen(false);
                setDeactivatingUser(null);
              }}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeactivate}
              disabled={deactivateUserMutation.isPending}
            >
              {deactivateUserMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Dezaktywuj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
