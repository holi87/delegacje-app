import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listDelegations } from '@/api/delegations';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

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

type StatusFilter = 'ALL' | 'DRAFT' | 'SUBMITTED' | 'SETTLED';

const filterTabs: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Wszystkie' },
  { value: 'DRAFT', label: 'Szkice' },
  { value: 'SUBMITTED', label: 'Zlozone' },
  { value: 'SETTLED', label: 'Rozliczone' },
];

interface Delegation {
  id: string;
  number: string | null;
  purpose: string;
  destination: string;
  departureAt: string;
  status: string;
  totalAmount?: string | null;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const { data, isLoading, error } = useQuery({
    queryKey: ['delegations', statusFilter],
    queryFn: () =>
      listDelegations({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
  });

  const delegations: Delegation[] = data?.delegations ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pulpit</h1>
        <Button asChild>
          <Link to="/delegations/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nowa delegacja
          </Link>
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
        {filterTabs.map((tab) => (
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
            Nie masz jeszcze zadnych delegacji. Utworz pierwsza delegacje.
          </p>
          <Button asChild className="mt-4">
            <Link to="/delegations/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nowa delegacja
            </Link>
          </Button>
        </div>
      )}

      {!isLoading && !error && delegations.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Nr</th>
                <th className="px-4 py-3 text-left font-medium">Cel</th>
                <th className="px-4 py-3 text-left font-medium">Miejsce</th>
                <th className="px-4 py-3 text-left font-medium">Data wyjazdu</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Kwota</th>
              </tr>
            </thead>
            <tbody>
              {delegations.map((delegation) => (
                <tr
                  key={delegation.id}
                  onClick={() => navigate(`/delegations/${delegation.id}`)}
                  className="cursor-pointer border-b transition-colors hover:bg-muted/50 last:border-b-0"
                >
                  <td className="px-4 py-3 font-medium">
                    {delegation.number ?? '---'}
                  </td>
                  <td className="px-4 py-3">{delegation.purpose}</td>
                  <td className="px-4 py-3">{delegation.destination}</td>
                  <td className="px-4 py-3">{formatDate(delegation.departureAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_COLORS[delegation.status] ?? 'bg-gray-100 text-gray-800'
                      )}
                    >
                      {STATUS_LABELS[delegation.status] ?? delegation.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {delegation.totalAmount
                      ? formatCurrency(delegation.totalAmount)
                      : '---'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
