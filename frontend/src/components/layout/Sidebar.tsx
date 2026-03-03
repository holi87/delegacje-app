import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  PlusCircle,
  User,
  Settings,
  Users,
  Building2,
  FileText,
} from 'lucide-react';

interface SidebarProps {
  onNavigate?: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

const mainNavItems: NavItem[] = [
  { to: '/', label: 'Pulpit', icon: LayoutDashboard },
  { to: '/delegations/new', label: 'Nowa delegacja', icon: PlusCircle },
  { to: '/profile', label: 'Moj profil', icon: User },
];

const adminNavItems: NavItem[] = [
  { to: '/admin/rates', label: 'Stawki', icon: Settings },
  { to: '/admin/users', label: 'Uzytkownicy', icon: Users },
  { to: '/admin/company', label: 'Dane firmy', icon: Building2 },
  { to: '/admin/delegations', label: 'Wszystkie delegacje', icon: FileText },
];

function NavLinkItem({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )
      }
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </NavLink>
  );
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <div className="mb-2 px-3 text-lg font-semibold text-foreground">
        Delegacje
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        <div className="space-y-1">
          {mainNavItems.map((item) => (
            <NavLinkItem key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </div>

        {isAdmin && (
          <>
            <div className="my-3 border-t" />
            <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Administracja
            </div>
            <div className="space-y-1">
              {adminNavItems.map((item) => (
                <NavLinkItem key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </>
        )}
      </nav>
    </div>
  );
}
