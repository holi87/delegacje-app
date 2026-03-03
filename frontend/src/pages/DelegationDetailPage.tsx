import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDelegation,
  calculateDelegation,
  submitDelegation,
  settleDelegation,
  reopenDelegation,
  deleteDelegation,
  downloadDelegationPdf,
} from '@/api/delegations';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableFooter,
} from '@/components/ui/table';
import {
  Loader2,
  ArrowLeft,
  Pencil,
  Trash2,
  SendHorizonal,
  CheckCircle,
  RotateCcw,
  Download,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { CalculationResult } from '../../../shared/types';

// ---------- Labels ----------

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Szkic',
  SUBMITTED: 'Zlozona',
  SETTLED: 'Rozliczona',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  SETTLED: 'bg-green-100 text-green-800',
};

const TRANSPORT_LABELS: Record<string, string> = {
  COMPANY_VEHICLE: 'Pojazd sluzbowy',
  PUBLIC_TRANSPORT: 'Transport publiczny',
  PRIVATE_VEHICLE: 'Pojazd prywatny (km)',
  MIXED: 'Mieszany',
};

const ACCOMMODATION_LABELS: Record<string, string> = {
  RECEIPT: 'Wg rachunku',
  LUMP_SUM: 'Ryczalt',
  FREE: 'Bezplatny',
  NONE: 'Brak',
};

const VEHICLE_LABELS: Record<string, string> = {
  CAR_ABOVE_900: 'Samochod > 900 cm\u00B3',
  CAR_BELOW_900: 'Samochod \u2264 900 cm\u00B3',
  MOTORCYCLE: 'Motocykl',
  MOPED: 'Motorower',
};

export default function DelegationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  // Fetch delegation
  const {
    data: delegationData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['delegation', id],
    queryFn: () => getDelegation(id!),
    enabled: !!id,
  });

  // Fetch calculation
  const {
    data: calculationData,
    isLoading: isCalcLoading,
  } = useQuery<CalculationResult>({
    queryKey: ['delegation-calculation', id],
    queryFn: () => calculateDelegation(id!),
    enabled: !!id && !!delegationData,
  });

  // Mutations
  const submitMut = useMutation({
    mutationFn: () => submitDelegation(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegation', id] });
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      toast.success('Delegacja zlozona', {
        description: 'Status zmieniony na "Zlozona".',
      });
    },
    onError: (err: any) => {
      toast.error('Blad', {
        description: err.response?.data?.message || 'Nie udalo sie zlozyc delegacji.',
      });
    },
  });

  const settleMut = useMutation({
    mutationFn: () => settleDelegation(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegation', id] });
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      toast.success('Delegacja rozliczona', {
        description: 'Status zmieniony na "Rozliczona".',
      });
    },
    onError: (err: any) => {
      toast.error('Blad', {
        description:
          err.response?.data?.message || 'Nie udalo sie rozliczyc delegacji.',
      });
    },
  });

  const reopenMut = useMutation({
    mutationFn: () => reopenDelegation(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegation', id] });
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      toast.success('Delegacja otwarta ponownie', {
        description: 'Status zmieniony na "Szkic".',
      });
    },
    onError: (err: any) => {
      toast.error('Blad', {
        description:
          err.response?.data?.message || 'Nie udalo sie otworzyc delegacji.',
      });
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteDelegation(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      toast.success('Delegacja usunieta');
      navigate('/');
    },
    onError: (err: any) => {
      toast.error('Blad', {
        description:
          err.response?.data?.message || 'Nie udalo sie usunac delegacji.',
      });
    },
  });

  const handleDownloadPdf = async () => {
    try {
      const blob = await downloadDelegationPdf(id!);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `delegacja-${delegation?.number ?? id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Blad pobierania PDF', {
        description:
          err.response?.data?.message || 'Nie udalo sie pobrac PDF.',
      });
    }
  };

  // Loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error
  if (error || !delegationData) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Powrot do pulpitu
        </Button>
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5" />
          Nie udalo sie wczytac delegacji.
        </div>
      </div>
    );
  }

  const delegation = delegationData.delegation ?? delegationData;
  const status = delegation.status as string;
  const calc = calculationData as CalculationResult | undefined;

  const isMutating =
    submitMut.isPending ||
    settleMut.isPending ||
    reopenMut.isPending ||
    deleteMut.isPending;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">
                {delegation.number ?? 'Delegacja'}
              </h1>
              <span
                className={cn(
                  'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                  STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800'
                )}
              >
                {STATUS_LABELS[status] ?? status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {delegation.purpose} &mdash; {delegation.destination}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {status === 'DRAFT' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/delegations/new`)}
                disabled={isMutating}
              >
                <Pencil className="mr-1 h-4 w-4" />
                Edytuj
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteMut.mutate()}
                disabled={isMutating}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Usun
              </Button>
              <Button
                size="sm"
                onClick={() => submitMut.mutate()}
                disabled={isMutating}
              >
                {submitMut.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizonal className="mr-1 h-4 w-4" />
                )}
                Zloz
              </Button>
            </>
          )}

          {status === 'SUBMITTED' && isAdmin && (
            <Button
              size="sm"
              onClick={() => settleMut.mutate()}
              disabled={isMutating}
            >
              {settleMut.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-1 h-4 w-4" />
              )}
              Rozlicz
            </Button>
          )}

          {status === 'SETTLED' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
              >
                <Download className="mr-1 h-4 w-4" />
                Pobierz PDF
              </Button>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => reopenMut.mutate()}
                  disabled={isMutating}
                >
                  {reopenMut.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-1 h-4 w-4" />
                  )}
                  Cofnij do szkicu
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Basic info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informacje podstawowe</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Cel delegacji: </span>
              <span className="font-medium">{delegation.purpose}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Miejsce: </span>
              <span className="font-medium">{delegation.destination}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Wyjazd: </span>
              <span className="font-medium">
                {formatDateTime(delegation.departureAt)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Powrot: </span>
              <span className="font-medium">
                {formatDateTime(delegation.returnAt)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Transport: </span>
              <span className="font-medium">
                {TRANSPORT_LABELS[delegation.transportType] ??
                  delegation.transportType}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Nocleg: </span>
              <span className="font-medium">
                {ACCOMMODATION_LABELS[delegation.accommodationType] ??
                  delegation.accommodationType}
              </span>
            </div>
            {delegation.vehicleType && (
              <div>
                <span className="text-muted-foreground">Pojazd: </span>
                <span className="font-medium">
                  {VEHICLE_LABELS[delegation.vehicleType] ??
                    delegation.vehicleType}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Calculation breakdown */}
      {isCalcLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Ladowanie obliczen...
          </span>
        </div>
      ) : calc ? (
        <>
          {/* Diet table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Diety</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">
                Stawka: {formatCurrency(calc.diet.rateUsed)} | Czas:{' '}
                {calc.duration.fullDays} dob, {Math.round(calc.duration.remainingHours)}h
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doba</TableHead>
                    <TableHead className="text-right">Godziny</TableHead>
                    <TableHead className="text-right">Podstawa</TableHead>
                    <TableHead className="text-right">Pomniejszenie</TableHead>
                    <TableHead className="text-right">Dieta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calc.diet.days.map((day) => (
                    <TableRow key={day.dayNumber}>
                      <TableCell>{day.dayNumber}</TableCell>
                      <TableCell className="text-right">
                        {Math.round(day.hours)}h
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(day.baseAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(String(day.deductions.total)) > 0 ? (
                          <span className="text-destructive">
                            -{formatCurrency(day.deductions.total)}
                          </span>
                        ) : (
                          '---'
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(day.finalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-semibold">
                      Suma diet
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(calc.diet.total)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {/* Accommodation */}
          {calc.accommodation.nights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Noclegi</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Noc</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead className="text-right">Kwota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calc.accommodation.nights.map((night, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {ACCOMMODATION_LABELS[night.type] ?? night.type}
                          </Badge>
                          {night.overLimit && (
                            <Badge variant="destructive" className="ml-2">
                              Ponad limit
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(night.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="font-semibold">
                        Suma noclegow
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(calc.accommodation.total)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Transport */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transport</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {calc.transport.mileage && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  Kilometrowka: {calc.transport.mileage.distanceKm} km x{' '}
                  {formatCurrency(calc.transport.mileage.ratePerKm)}/km ={' '}
                  <span className="font-semibold">
                    {formatCurrency(calc.transport.mileage.total)}
                  </span>
                </div>
              )}

              {calc.transport.receipts.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Opis</TableHead>
                      <TableHead className="text-right">Kwota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calc.transport.receipts.map((r, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{r.description}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(r.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="text-sm font-semibold">
                Transport razem: {formatCurrency(calc.transport.total)}
              </div>
            </CardContent>
          </Card>

          {/* Additional costs */}
          {calc.additionalCosts.items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Koszty dodatkowe</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Opis</TableHead>
                      <TableHead className="text-right">Kwota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calc.additionalCosts.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">Suma</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(calc.additionalCosts.total)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Grand total */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="text-base">Podsumowanie kosztow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Diety</span>
                  <span>{formatCurrency(calc.summary.dietTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Noclegi</span>
                  <span>{formatCurrency(calc.summary.accommodationTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transport</span>
                  <span>{formatCurrency(calc.summary.transportTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Koszty dodatkowe</span>
                  <span>{formatCurrency(calc.summary.additionalTotal)}</span>
                </div>

                <Separator />

                <div className="flex justify-between font-semibold">
                  <span>Suma calkowita</span>
                  <span>{formatCurrency(calc.summary.grandTotal)}</span>
                </div>

                <div className="flex justify-between text-muted-foreground">
                  <span>Zaliczka</span>
                  <span>-{formatCurrency(calc.summary.advanceAmount)}</span>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>
                    {parseFloat(String(calc.summary.amountDue)) >= 0
                      ? 'Do wyplaty'
                      : 'Do zwrotu'}
                  </span>
                  <span
                    className={
                      parseFloat(String(calc.summary.amountDue)) < 0
                        ? 'text-destructive'
                        : 'text-primary'
                    }
                  >
                    {formatCurrency(
                      Math.abs(parseFloat(String(calc.summary.amountDue)))
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
