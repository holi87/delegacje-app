import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDomesticRates,
  createDomesticRate,
  updateDomesticRate,
  getMileageRates,
  createMileageRate,
  updateMileageRate,
  getForeignRates,
  createForeignRate,
  updateForeignRate,
  deleteForeignRate,
} from '@/api/admin';
import { formatCurrency, formatDate } from '@/utils/formatters';
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
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import type { DomesticRate, MileageRate, ForeignDietRate, VehicleType } from '../../../../shared/types';

// --- Constants ---

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  CAR_ABOVE_900: 'Samochod > 900 cm\u00b3',
  CAR_BELOW_900: 'Samochod \u2264 900 cm\u00b3',
  MOTORCYCLE: 'Motocykl',
  MOPED: 'Motorower',
};

const VEHICLE_TYPES: VehicleType[] = [
  'CAR_ABOVE_900',
  'CAR_BELOW_900',
  'MOTORCYCLE',
  'MOPED',
];

// --- Schemas ---

const domesticRateSchema = z.object({
  dailyDiet: z.string().min(1, 'Stawka diety jest wymagana'),
  accommodationLumpSum: z.string().min(1, 'Ryczalt za nocleg jest wymagany'),
  accommodationMaxReceipt: z.string().min(1, 'Limit za nocleg wg rachunku jest wymagany'),
  localTransportLumpSum: z.string().min(1, 'Ryczalt na przejazdy lokalne jest wymagany'),
  breakfastDeductionPct: z.coerce
    .number()
    .min(0, 'Minimum 0%')
    .max(100, 'Maksimum 100%'),
  lunchDeductionPct: z.coerce
    .number()
    .min(0, 'Minimum 0%')
    .max(100, 'Maksimum 100%'),
  dinnerDeductionPct: z.coerce
    .number()
    .min(0, 'Minimum 0%')
    .max(100, 'Maksimum 100%'),
  validFrom: z.string().min(1, 'Data obowiazywania od jest wymagana'),
  validTo: z.string().optional(),
});

type DomesticRateFormData = z.infer<typeof domesticRateSchema>;

const mileageRateSchema = z.object({
  vehicleType: z.string().min(1, 'Typ pojazdu jest wymagany'),
  ratePerKm: z.string().min(1, 'Stawka za km jest wymagana'),
  validFrom: z.string().min(1, 'Data obowiazywania od jest wymagana'),
  validTo: z.string().optional(),
});

type MileageRateFormData = z.infer<typeof mileageRateSchema>;

const foreignRateSchema = z.object({
  countryCode: z.string().min(2, 'Kod kraju jest wymagany (2-3 znaki)').max(3),
  countryName: z.string().min(1, 'Nazwa kraju jest wymagana'),
  currency: z.string().length(3, 'Waluta musi miec 3 znaki'),
  dailyDiet: z.string().min(1, 'Stawka diety jest wymagana'),
  accommodationLimit: z.string().min(1, 'Limit noclegu jest wymagany'),
  breakfastDeductionPct: z.coerce.number().min(0).max(100),
  lunchDeductionPct: z.coerce.number().min(0).max(100),
  dinnerDeductionPct: z.coerce.number().min(0).max(100),
  validFrom: z.string().min(1, 'Data obowiazywania od jest wymagana'),
  validTo: z.string().optional(),
});

type ForeignRateFormData = z.infer<typeof foreignRateSchema>;

// --- Component ---

export default function AdminRatesPage() {
  const queryClient = useQueryClient();

  // Domestic rates dialog state
  const [domesticDialogOpen, setDomesticDialogOpen] = useState(false);
  const [editingDomesticRate, setEditingDomesticRate] = useState<DomesticRate | null>(null);

  // Mileage rates dialog state
  const [mileageDialogOpen, setMileageDialogOpen] = useState(false);
  const [editingMileageRate, setEditingMileageRate] = useState<MileageRate | null>(null);

  // Foreign rates dialog state
  const [foreignDialogOpen, setForeignDialogOpen] = useState(false);
  const [editingForeignRate, setEditingForeignRate] = useState<ForeignDietRate | null>(null);

  // --- Queries ---

  const {
    data: domesticRatesData,
    isLoading: domesticLoading,
  } = useQuery({
    queryKey: ['admin', 'rates', 'domestic'],
    queryFn: getDomesticRates,
  });

  const {
    data: mileageRatesData,
    isLoading: mileageLoading,
  } = useQuery({
    queryKey: ['admin', 'rates', 'mileage'],
    queryFn: getMileageRates,
  });

  const {
    data: foreignRatesData,
    isLoading: foreignLoading,
  } = useQuery({
    queryKey: ['admin', 'rates', 'foreign'],
    queryFn: getForeignRates,
  });

  const domesticRates: DomesticRate[] = domesticRatesData?.rates ?? domesticRatesData ?? [];
  const mileageRates: MileageRate[] = mileageRatesData?.rates ?? mileageRatesData ?? [];
  const foreignRates: ForeignDietRate[] = foreignRatesData?.rates ?? foreignRatesData ?? [];

  // --- Domestic rate form ---

  const domesticForm = useForm<DomesticRateFormData>({
    resolver: zodResolver(domesticRateSchema),
    defaultValues: {
      dailyDiet: '',
      accommodationLumpSum: '',
      accommodationMaxReceipt: '',
      localTransportLumpSum: '',
      breakfastDeductionPct: 25,
      lunchDeductionPct: 50,
      dinnerDeductionPct: 25,
      validFrom: '',
      validTo: '',
    },
  });

  const createDomesticMutation = useMutation({
    mutationFn: (data: DomesticRateFormData) =>
      createDomesticRate({
        ...data,
        validTo: data.validTo || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rates', 'domestic'] });
      toast.success('Stawka diety krajowej zostala dodana');
      closeDomesticDialog();
    },
    onError: () => {
      toast.error('Nie udalo sie dodac stawki');
    },
  });

  const updateDomesticMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DomesticRateFormData }) =>
      updateDomesticRate(id, {
        ...data,
        validTo: data.validTo || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rates', 'domestic'] });
      toast.success('Stawka diety krajowej zostala zaktualizowana');
      closeDomesticDialog();
    },
    onError: () => {
      toast.error('Nie udalo sie zaktualizowac stawki');
    },
  });

  function openNewDomesticDialog() {
    setEditingDomesticRate(null);
    domesticForm.reset({
      dailyDiet: '',
      accommodationLumpSum: '',
      accommodationMaxReceipt: '',
      localTransportLumpSum: '',
      breakfastDeductionPct: 25,
      lunchDeductionPct: 50,
      dinnerDeductionPct: 25,
      validFrom: '',
      validTo: '',
    });
    setDomesticDialogOpen(true);
  }

  function openEditDomesticDialog(rate: DomesticRate) {
    setEditingDomesticRate(rate);
    domesticForm.reset({
      dailyDiet: rate.dailyDiet,
      accommodationLumpSum: rate.accommodationLumpSum,
      accommodationMaxReceipt: rate.accommodationMaxReceipt,
      localTransportLumpSum: rate.localTransportLumpSum,
      breakfastDeductionPct: rate.breakfastDeductionPct,
      lunchDeductionPct: rate.lunchDeductionPct,
      dinnerDeductionPct: rate.dinnerDeductionPct,
      validFrom: rate.validFrom.substring(0, 10),
      validTo: rate.validTo ? rate.validTo.substring(0, 10) : '',
    });
    setDomesticDialogOpen(true);
  }

  function closeDomesticDialog() {
    setDomesticDialogOpen(false);
    setEditingDomesticRate(null);
    domesticForm.reset();
  }

  function onDomesticSubmit(data: DomesticRateFormData) {
    if (editingDomesticRate) {
      updateDomesticMutation.mutate({ id: editingDomesticRate.id, data });
    } else {
      createDomesticMutation.mutate(data);
    }
  }

  // --- Mileage rate form ---

  const mileageForm = useForm<MileageRateFormData>({
    resolver: zodResolver(mileageRateSchema),
    defaultValues: {
      vehicleType: '',
      ratePerKm: '',
      validFrom: '',
      validTo: '',
    },
  });

  const createMileageMutation = useMutation({
    mutationFn: (data: MileageRateFormData) =>
      createMileageRate({
        ...data,
        validTo: data.validTo || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rates', 'mileage'] });
      toast.success('Stawka kilometrowki zostala dodana');
      closeMileageDialog();
    },
    onError: () => {
      toast.error('Nie udalo sie dodac stawki');
    },
  });

  const updateMileageMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MileageRateFormData }) =>
      updateMileageRate(id, {
        ...data,
        validTo: data.validTo || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rates', 'mileage'] });
      toast.success('Stawka kilometrowki zostala zaktualizowana');
      closeMileageDialog();
    },
    onError: () => {
      toast.error('Nie udalo sie zaktualizowac stawki');
    },
  });

  function openNewMileageDialog() {
    setEditingMileageRate(null);
    mileageForm.reset({
      vehicleType: '',
      ratePerKm: '',
      validFrom: '',
      validTo: '',
    });
    setMileageDialogOpen(true);
  }

  function openEditMileageDialog(rate: MileageRate) {
    setEditingMileageRate(rate);
    mileageForm.reset({
      vehicleType: rate.vehicleType,
      ratePerKm: rate.ratePerKm,
      validFrom: rate.validFrom.substring(0, 10),
      validTo: rate.validTo ? rate.validTo.substring(0, 10) : '',
    });
    setMileageDialogOpen(true);
  }

  function closeMileageDialog() {
    setMileageDialogOpen(false);
    setEditingMileageRate(null);
    mileageForm.reset();
  }

  function onMileageSubmit(data: MileageRateFormData) {
    if (editingMileageRate) {
      updateMileageMutation.mutate({ id: editingMileageRate.id, data });
    } else {
      createMileageMutation.mutate(data);
    }
  }

  // --- Foreign rate form ---

  const foreignForm = useForm<ForeignRateFormData>({
    resolver: zodResolver(foreignRateSchema),
    defaultValues: {
      countryCode: '',
      countryName: '',
      currency: '',
      dailyDiet: '',
      accommodationLimit: '',
      breakfastDeductionPct: 15,
      lunchDeductionPct: 30,
      dinnerDeductionPct: 30,
      validFrom: '',
      validTo: '',
    },
  });

  const createForeignMutation = useMutation({
    mutationFn: (data: ForeignRateFormData) =>
      createForeignRate({
        ...data,
        validTo: data.validTo || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rates', 'foreign'] });
      toast.success('Stawka diety zagranicznej zostala dodana');
      closeForeignDialog();
    },
    onError: () => {
      toast.error('Nie udalo sie dodac stawki');
    },
  });

  const updateForeignMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ForeignRateFormData }) =>
      updateForeignRate(id, {
        ...data,
        validTo: data.validTo || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rates', 'foreign'] });
      toast.success('Stawka diety zagranicznej zostala zaktualizowana');
      closeForeignDialog();
    },
    onError: () => {
      toast.error('Nie udalo sie zaktualizowac stawki');
    },
  });

  const deleteForeignMutation = useMutation({
    mutationFn: (id: string) => deleteForeignRate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rates', 'foreign'] });
      toast.success('Stawka diety zagranicznej zostala usunieta');
    },
    onError: () => {
      toast.error('Nie udalo sie usunac stawki');
    },
  });

  function openNewForeignDialog() {
    setEditingForeignRate(null);
    foreignForm.reset({
      countryCode: '',
      countryName: '',
      currency: '',
      dailyDiet: '',
      accommodationLimit: '',
      breakfastDeductionPct: 15,
      lunchDeductionPct: 30,
      dinnerDeductionPct: 30,
      validFrom: '',
      validTo: '',
    });
    setForeignDialogOpen(true);
  }

  function openEditForeignDialog(rate: ForeignDietRate) {
    setEditingForeignRate(rate);
    foreignForm.reset({
      countryCode: rate.countryCode,
      countryName: rate.countryName,
      currency: rate.currency,
      dailyDiet: rate.dailyDiet,
      accommodationLimit: rate.accommodationLimit,
      breakfastDeductionPct: rate.breakfastDeductionPct,
      lunchDeductionPct: rate.lunchDeductionPct,
      dinnerDeductionPct: rate.dinnerDeductionPct,
      validFrom: rate.validFrom.substring(0, 10),
      validTo: rate.validTo ? rate.validTo.substring(0, 10) : '',
    });
    setForeignDialogOpen(true);
  }

  function closeForeignDialog() {
    setForeignDialogOpen(false);
    setEditingForeignRate(null);
    foreignForm.reset();
  }

  function onForeignSubmit(data: ForeignRateFormData) {
    if (editingForeignRate) {
      updateForeignMutation.mutate({ id: editingForeignRate.id, data });
    } else {
      createForeignMutation.mutate(data);
    }
  }

  const isDomesticPending =
    createDomesticMutation.isPending || updateDomesticMutation.isPending;
  const isMileagePending =
    createMileageMutation.isPending || updateMileageMutation.isPending;
  const isForeignPending =
    createForeignMutation.isPending || updateForeignMutation.isPending;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Zarzadzanie stawkami</h1>

      {/* Domestic rates section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Stawki diety krajowej</CardTitle>
              <CardDescription>
                Stawki diet, noclegow i ryczaltow dla delegacji krajowych
              </CardDescription>
            </div>
            <Button onClick={openNewDomesticDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj stawke
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {domesticLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : domesticRates.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Brak zdefiniowanych stawek diety krajowej.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dieta dzienna</TableHead>
                  <TableHead>Ryczalt nocleg</TableHead>
                  <TableHead>Limit nocleg (rachunek)</TableHead>
                  <TableHead>Ryczalt transport lok.</TableHead>
                  <TableHead>Pomniejszenia (%)</TableHead>
                  <TableHead>Obowiazuje od</TableHead>
                  <TableHead>Obowiazuje do</TableHead>
                  <TableHead className="w-[50px]">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domesticRates.map((rate: DomesticRate) => (
                  <TableRow key={rate.id}>
                    <TableCell>{formatCurrency(rate.dailyDiet)}</TableCell>
                    <TableCell>{formatCurrency(rate.accommodationLumpSum)}</TableCell>
                    <TableCell>{formatCurrency(rate.accommodationMaxReceipt)}</TableCell>
                    <TableCell>{formatCurrency(rate.localTransportLumpSum)}</TableCell>
                    <TableCell className="text-xs">
                      <div>Sniad.: {rate.breakfastDeductionPct}%</div>
                      <div>Obiad: {rate.lunchDeductionPct}%</div>
                      <div>Kolacja: {rate.dinnerDeductionPct}%</div>
                    </TableCell>
                    <TableCell>{formatDate(rate.validFrom)}</TableCell>
                    <TableCell>
                      {rate.validTo ? formatDate(rate.validTo) : 'Bezterminowo'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDomesticDialog(rate)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Mileage rates section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Stawki kilometrowki</CardTitle>
              <CardDescription>
                Stawki za 1 km przebiegu pojazdu prywatnego
              </CardDescription>
            </div>
            <Button onClick={openNewMileageDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj stawke
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {mileageLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : mileageRates.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Brak zdefiniowanych stawek kilometrowki.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ pojazdu</TableHead>
                  <TableHead>Stawka za km</TableHead>
                  <TableHead>Obowiazuje od</TableHead>
                  <TableHead>Obowiazuje do</TableHead>
                  <TableHead className="w-[50px]">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mileageRates.map((rate: MileageRate) => (
                  <TableRow key={rate.id}>
                    <TableCell>
                      {VEHICLE_TYPE_LABELS[rate.vehicleType] ?? rate.vehicleType}
                    </TableCell>
                    <TableCell>{formatCurrency(rate.ratePerKm)}</TableCell>
                    <TableCell>{formatDate(rate.validFrom)}</TableCell>
                    <TableCell>
                      {rate.validTo ? formatDate(rate.validTo) : 'Bezterminowo'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditMileageDialog(rate)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Foreign diet rates section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Stawki diet zagranicznych</CardTitle>
              <CardDescription>
                Stawki diet i limitow noclegow dla delegacji zagranicznych
              </CardDescription>
            </div>
            <Button onClick={openNewForeignDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj stawke
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {foreignLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : foreignRates.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Brak zdefiniowanych stawek diet zagranicznych.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kraj</TableHead>
                  <TableHead>Kod</TableHead>
                  <TableHead>Waluta</TableHead>
                  <TableHead>Dieta dzienna</TableHead>
                  <TableHead>Limit noclegu</TableHead>
                  <TableHead>Pomniejszenia (%)</TableHead>
                  <TableHead>Obowiazuje od</TableHead>
                  <TableHead className="w-[80px]">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {foreignRates.map((rate: ForeignDietRate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">{rate.countryName}</TableCell>
                    <TableCell>{rate.countryCode}</TableCell>
                    <TableCell>{rate.currency}</TableCell>
                    <TableCell>{rate.dailyDiet} {rate.currency}</TableCell>
                    <TableCell>{rate.accommodationLimit} {rate.currency}</TableCell>
                    <TableCell className="text-xs">
                      <div>Sniad.: {rate.breakfastDeductionPct}%</div>
                      <div>Obiad: {rate.lunchDeductionPct}%</div>
                      <div>Kolacja: {rate.dinnerDeductionPct}%</div>
                    </TableCell>
                    <TableCell>{formatDate(rate.validFrom)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditForeignDialog(rate)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteForeignMutation.mutate(rate.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Domestic rate dialog */}
      <Dialog open={domesticDialogOpen} onOpenChange={setDomesticDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingDomesticRate
                ? 'Edytuj stawke diety krajowej'
                : 'Nowa stawka diety krajowej'}
            </DialogTitle>
            <DialogDescription>
              {editingDomesticRate
                ? 'Zmien wartosci stawki diety krajowej.'
                : 'Wprowadz nowe stawki diety krajowej.'}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={domesticForm.handleSubmit(onDomesticSubmit)}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dr-dailyDiet">Dieta dzienna (zl)</Label>
                <Input
                  id="dr-dailyDiet"
                  type="number"
                  step="0.01"
                  placeholder="45.00"
                  {...domesticForm.register('dailyDiet')}
                />
                {domesticForm.formState.errors.dailyDiet && (
                  <p className="text-sm text-destructive">
                    {domesticForm.formState.errors.dailyDiet.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dr-accommodationLumpSum">Ryczalt za nocleg (zl)</Label>
                <Input
                  id="dr-accommodationLumpSum"
                  type="number"
                  step="0.01"
                  placeholder="67.50"
                  {...domesticForm.register('accommodationLumpSum')}
                />
                {domesticForm.formState.errors.accommodationLumpSum && (
                  <p className="text-sm text-destructive">
                    {domesticForm.formState.errors.accommodationLumpSum.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dr-accommodationMaxReceipt">
                  Limit nocleg wg rachunku (zl)
                </Label>
                <Input
                  id="dr-accommodationMaxReceipt"
                  type="number"
                  step="0.01"
                  placeholder="900.00"
                  {...domesticForm.register('accommodationMaxReceipt')}
                />
                {domesticForm.formState.errors.accommodationMaxReceipt && (
                  <p className="text-sm text-destructive">
                    {domesticForm.formState.errors.accommodationMaxReceipt.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dr-localTransportLumpSum">
                  Ryczalt na przejazdy lokalne (zl)
                </Label>
                <Input
                  id="dr-localTransportLumpSum"
                  type="number"
                  step="0.01"
                  placeholder="9.00"
                  {...domesticForm.register('localTransportLumpSum')}
                />
                {domesticForm.formState.errors.localTransportLumpSum && (
                  <p className="text-sm text-destructive">
                    {domesticForm.formState.errors.localTransportLumpSum.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dr-breakfastDeductionPct">Pomniejszenie sniadanie (%)</Label>
                <Input
                  id="dr-breakfastDeductionPct"
                  type="number"
                  min={0}
                  max={100}
                  {...domesticForm.register('breakfastDeductionPct')}
                />
                {domesticForm.formState.errors.breakfastDeductionPct && (
                  <p className="text-sm text-destructive">
                    {domesticForm.formState.errors.breakfastDeductionPct.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dr-lunchDeductionPct">Pomniejszenie obiad (%)</Label>
                <Input
                  id="dr-lunchDeductionPct"
                  type="number"
                  min={0}
                  max={100}
                  {...domesticForm.register('lunchDeductionPct')}
                />
                {domesticForm.formState.errors.lunchDeductionPct && (
                  <p className="text-sm text-destructive">
                    {domesticForm.formState.errors.lunchDeductionPct.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dr-dinnerDeductionPct">Pomniejszenie kolacja (%)</Label>
                <Input
                  id="dr-dinnerDeductionPct"
                  type="number"
                  min={0}
                  max={100}
                  {...domesticForm.register('dinnerDeductionPct')}
                />
                {domesticForm.formState.errors.dinnerDeductionPct && (
                  <p className="text-sm text-destructive">
                    {domesticForm.formState.errors.dinnerDeductionPct.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dr-validFrom">Obowiazuje od</Label>
                <Input
                  id="dr-validFrom"
                  type="date"
                  {...domesticForm.register('validFrom')}
                />
                {domesticForm.formState.errors.validFrom && (
                  <p className="text-sm text-destructive">
                    {domesticForm.formState.errors.validFrom.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dr-validTo">Obowiazuje do (opcjonalnie)</Label>
                <Input
                  id="dr-validTo"
                  type="date"
                  {...domesticForm.register('validTo')}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDomesticDialog}
              >
                Anuluj
              </Button>
              <Button type="submit" disabled={isDomesticPending}>
                {isDomesticPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingDomesticRate ? 'Zapisz zmiany' : 'Dodaj stawke'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mileage rate dialog */}
      <Dialog open={mileageDialogOpen} onOpenChange={setMileageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMileageRate
                ? 'Edytuj stawke kilometrowki'
                : 'Nowa stawka kilometrowki'}
            </DialogTitle>
            <DialogDescription>
              {editingMileageRate
                ? 'Zmien wartosci stawki kilometrowki.'
                : 'Wprowadz nowa stawke kilometrowki.'}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={mileageForm.handleSubmit(onMileageSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Typ pojazdu</Label>
              <Select
                value={mileageForm.watch('vehicleType')}
                onValueChange={(value) => mileageForm.setValue('vehicleType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz typ pojazdu" />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((vt) => (
                    <SelectItem key={vt} value={vt}>
                      {VEHICLE_TYPE_LABELS[vt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {mileageForm.formState.errors.vehicleType && (
                <p className="text-sm text-destructive">
                  {mileageForm.formState.errors.vehicleType.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="mr-ratePerKm">Stawka za km (zl)</Label>
              <Input
                id="mr-ratePerKm"
                type="number"
                step="0.01"
                placeholder="0.89"
                {...mileageForm.register('ratePerKm')}
              />
              {mileageForm.formState.errors.ratePerKm && (
                <p className="text-sm text-destructive">
                  {mileageForm.formState.errors.ratePerKm.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mr-validFrom">Obowiazuje od</Label>
                <Input
                  id="mr-validFrom"
                  type="date"
                  {...mileageForm.register('validFrom')}
                />
                {mileageForm.formState.errors.validFrom && (
                  <p className="text-sm text-destructive">
                    {mileageForm.formState.errors.validFrom.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="mr-validTo">Obowiazuje do (opcjonalnie)</Label>
                <Input
                  id="mr-validTo"
                  type="date"
                  {...mileageForm.register('validTo')}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeMileageDialog}
              >
                Anuluj
              </Button>
              <Button type="submit" disabled={isMileagePending}>
                {isMileagePending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingMileageRate ? 'Zapisz zmiany' : 'Dodaj stawke'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Foreign rate dialog */}
      <Dialog open={foreignDialogOpen} onOpenChange={setForeignDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingForeignRate
                ? 'Edytuj stawke diety zagranicznej'
                : 'Nowa stawka diety zagranicznej'}
            </DialogTitle>
            <DialogDescription>
              {editingForeignRate
                ? 'Zmien wartosci stawki diety zagranicznej.'
                : 'Wprowadz nowa stawke diety zagranicznej.'}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={foreignForm.handleSubmit(onForeignSubmit)}
            className="space-y-4"
          >
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fr-countryCode">Kod kraju</Label>
                <Input
                  id="fr-countryCode"
                  placeholder="DE"
                  maxLength={3}
                  {...foreignForm.register('countryCode')}
                />
                {foreignForm.formState.errors.countryCode && (
                  <p className="text-sm text-destructive">
                    {foreignForm.formState.errors.countryCode.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fr-countryName">Nazwa kraju</Label>
                <Input
                  id="fr-countryName"
                  placeholder="Niemcy"
                  {...foreignForm.register('countryName')}
                />
                {foreignForm.formState.errors.countryName && (
                  <p className="text-sm text-destructive">
                    {foreignForm.formState.errors.countryName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fr-currency">Waluta</Label>
                <Input
                  id="fr-currency"
                  placeholder="EUR"
                  maxLength={3}
                  {...foreignForm.register('currency')}
                />
                {foreignForm.formState.errors.currency && (
                  <p className="text-sm text-destructive">
                    {foreignForm.formState.errors.currency.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fr-dailyDiet">Dieta dzienna</Label>
                <Input
                  id="fr-dailyDiet"
                  type="number"
                  step="0.01"
                  placeholder="49.00"
                  {...foreignForm.register('dailyDiet')}
                />
                {foreignForm.formState.errors.dailyDiet && (
                  <p className="text-sm text-destructive">
                    {foreignForm.formState.errors.dailyDiet.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fr-accommodationLimit">Limit noclegu</Label>
                <Input
                  id="fr-accommodationLimit"
                  type="number"
                  step="0.01"
                  placeholder="150.00"
                  {...foreignForm.register('accommodationLimit')}
                />
                {foreignForm.formState.errors.accommodationLimit && (
                  <p className="text-sm text-destructive">
                    {foreignForm.formState.errors.accommodationLimit.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fr-breakfastDeductionPct">Pomniejszenie sniadanie (%)</Label>
                <Input
                  id="fr-breakfastDeductionPct"
                  type="number"
                  min={0}
                  max={100}
                  {...foreignForm.register('breakfastDeductionPct')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fr-lunchDeductionPct">Pomniejszenie obiad (%)</Label>
                <Input
                  id="fr-lunchDeductionPct"
                  type="number"
                  min={0}
                  max={100}
                  {...foreignForm.register('lunchDeductionPct')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fr-dinnerDeductionPct">Pomniejszenie kolacja (%)</Label>
                <Input
                  id="fr-dinnerDeductionPct"
                  type="number"
                  min={0}
                  max={100}
                  {...foreignForm.register('dinnerDeductionPct')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fr-validFrom">Obowiazuje od</Label>
                <Input
                  id="fr-validFrom"
                  type="date"
                  {...foreignForm.register('validFrom')}
                />
                {foreignForm.formState.errors.validFrom && (
                  <p className="text-sm text-destructive">
                    {foreignForm.formState.errors.validFrom.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fr-validTo">Obowiazuje do (opcjonalnie)</Label>
                <Input
                  id="fr-validTo"
                  type="date"
                  {...foreignForm.register('validTo')}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeForeignDialog}
              >
                Anuluj
              </Button>
              <Button type="submit" disabled={isForeignPending}>
                {isForeignPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingForeignRate ? 'Zapisz zmiany' : 'Dodaj stawke'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
