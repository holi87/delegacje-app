import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listDelegations, settleDelegation, reopenDelegation } from '@/api/delegations';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Loader2, MoreHorizontal, CheckCircle, RotateCcw, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DelegationStatus } from '../../../../shared/types';

// --- Constants ---

const STATUS_LABELS: Record<DelegationStatus, string> = {
  DRAFT: 'Szkic',
  SUBMITTED: 'Zlozona',
  SETTLED: 'Rozliczona',
};

const STATUS_COLORS: Record<DelegationStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  SUBMITTED: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  SETTLED: 'bg-green-100 text-green-800 hover:bg-green-100',
};

type StatusFilter = 'ALL' | DelegationStatus;

const FILTER_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Wszystkie' },
  { value: 'DRAFT', label: 'Szkice' },
  { value: 'SUBMITTED', label: 'Zlozone' },
  { value: 'SETTLED', label: 'Rozliczone' },
];

// --- Types ---

interface DelegationListItem {
  id: string;
  number: string | null;
  purpose: string;
  destination: string;
  departureAt: string;
  returnAt: string;
  status: DelegationStatus;
  grandTotal?: string | null;
  amountDue?: string | null;
  user?: {
    id: string;
    email: string;
    profile?: {
      firstName: string;
      lastName: string;
    } | null;
  };
}

// --- Component ---

export default function AdminDelegationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Confirmation dialogs
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [settlingDelegation, setSettlingDelegation] = useState<DelegationListItem | null>(null);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reopeningDelegation, setReopeningDelegation] = useState<DelegationListItem | null>(null);

  // --- Query ---

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'delegations', statusFilter],
    queryFn: () =>
      listDelegations({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
  });

  const delegations: DelegationListItem[] = data?.delegations ?? [];

  // --- Mutations ---

  const settleMutation = useMutation({
    mutationFn: settleDelegation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'delegations'] });
      toast.success('Delegacja zostala rozliczona');
      setSettleDialogOpen(false);
      setSettlingDelegation(null);
    },
    onError: () => {
      toast.error('Nie udalo sie rozliczyc delegacji');
    },
  });

  const reopenMutation = useMutation({
    mutationFn: reopenDelegation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'delegations'] });
      toast.success('Delegacja zostala cofnieta do szkicu');
      setReopenDialogOpen(false);
      setReopeningDelegation(null);
    },
    onError: () => {
      toast.error('Nie udalo sie cofnac delegacji');
    },
  });

  // --- Helpers ---

  function getUserDisplayName(delegation: DelegationListItem): string {
    if (delegation.user?.profile) {
      return `${delegation.user.profile.firstName} ${delegation.user.profile.lastName}`;
    }
    return delegation.user?.email ?? '---';
  }

  function openSettleDialog(delegation: DelegationListItem) {
    setSettlingDelegation(delegation);
    setSettleDialogOpen(true);
  }

  function confirmSettle() {
    if (!settlingDelegation) return;
    settleMutation.mutate(settlingDelegation.id);
  }

  function openReopenDialog(delegation: DelegationListItem) {
    setReopeningDelegation(delegation);
    setReopenDialogOpen(true);
  }

  function confirmReopen() {
    if (!reopeningDelegation) return;
    reopenMutation.mutate(reopeningDelegation.id);
  }

  function handleRowClick(delegation: DelegationListItem, e: React.MouseEvent) {
    // Prevent navigation when clicking action buttons
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="menu"]')) {
      return;
    }
    navigate(`/delegations/${delegation.id}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Wszystkie delegacje</h1>

      {/* Status filter tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              statusFilter === tab.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          Nie udalo sie wczytac delegacji. Sprobuj odswiezyc strone.
        </div>
      )}

      {!isLoading && !error && delegations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium">Brak delegacji</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Nie znaleziono delegacji spelniajacych kryteria.
          </p>
        </div>
      )}

      {!isLoading && !error && delegations.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nr</TableHead>
                <TableHead>Delegowany</TableHead>
                <TableHead>Cel</TableHead>
                <TableHead>Miejsce</TableHead>
                <TableHead>Data wyjazdu</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Kwota</TableHead>
                <TableHead className="w-[70px]">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {delegations.map((delegation) => (
                <TableRow
                  key={delegation.id}
                  className="cursor-pointer"
                  onClick={(e) => handleRowClick(delegation, e)}
                >
                  <TableCell className="font-medium">
                    {delegation.number ?? '---'}
                  </TableCell>
                  <TableCell>{getUserDisplayName(delegation)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {delegation.purpose}
                  </TableCell>
                  <TableCell>{delegation.destination}</TableCell>
                  <TableCell>{formatDate(delegation.departureAt)}</TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        STATUS_COLORS[delegation.status] ?? 'bg-gray-100 text-gray-800'
                      )}
                    >
                      {STATUS_LABELS[delegation.status] ?? delegation.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {delegation.grandTotal
                      ? formatCurrency(delegation.grandTotal)
                      : '---'}
                  </TableCell>
                  <TableCell>
                    {(delegation.status === 'SUBMITTED' ||
                      delegation.status === 'SETTLED') && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {delegation.status === 'SUBMITTED' && (
                            <DropdownMenuItem
                              onClick={() => openSettleDialog(delegation)}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Rozlicz
                            </DropdownMenuItem>
                          )}
                          {delegation.status === 'SETTLED' && (
                            <DropdownMenuItem
                              onClick={() => openReopenDialog(delegation)}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Cofnij do szkicu
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Settle confirmation dialog */}
      <Dialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rozliczenie delegacji</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz rozliczyc delegacje{' '}
              <strong>{settlingDelegation?.number ?? '---'}</strong> uzytkownika{' '}
              <strong>
                {settlingDelegation ? getUserDisplayName(settlingDelegation) : ''}
              </strong>
              ?
              {settlingDelegation?.grandTotal && (
                <>
                  {' '}
                  Kwota do rozliczenia:{' '}
                  <strong>{formatCurrency(settlingDelegation.grandTotal)}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSettleDialogOpen(false);
                setSettlingDelegation(null);
              }}
            >
              Anuluj
            </Button>
            <Button
              onClick={confirmSettle}
              disabled={settleMutation.isPending}
            >
              {settleMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Rozlicz delegacje
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen confirmation dialog */}
      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cofniecie delegacji</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz cofnac delegacje{' '}
              <strong>{reopeningDelegation?.number ?? '---'}</strong> do statusu
              szkicu? Delegowany bedzie mogl ja ponownie edytowac.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReopenDialogOpen(false);
                setReopeningDelegation(null);
              }}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReopen}
              disabled={reopenMutation.isPending}
            >
              {reopenMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Cofnij do szkicu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
