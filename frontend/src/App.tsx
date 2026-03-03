import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { checkSetupStatus } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import LoginPage from '@/pages/LoginPage';
import SetupWizardPage from '@/pages/SetupWizardPage';
import DashboardPage from '@/pages/DashboardPage';
import NewDelegationPage from '@/pages/NewDelegationPage';
import DelegationDetailPage from '@/pages/DelegationDetailPage';
import ProfilePage from '@/pages/ProfilePage';
import NotFoundPage from '@/pages/NotFoundPage';
import AdminRatesPage from '@/pages/admin/AdminRatesPage';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminCompanyPage from '@/pages/admin/AdminCompanyPage';
import AdminDelegationsPage from '@/pages/admin/AdminDelegationsPage';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function AdminRoute() {
  const user = useAuthStore((s) => s.user);

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function App() {
  const { data: setupStatus, isLoading } = useQuery({
    queryKey: ['setup-status'],
    queryFn: checkSetupStatus,
    staleTime: Infinity,
    retry: false,
  });

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (setupStatus?.needsSetup) {
    return (
      <ErrorBoundary>
        <>
          <SetupWizardPage />
          <Toaster position="top-right" richColors />
        </>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/delegations/new" element={<NewDelegationPage />} />
            <Route path="/delegations/:id" element={<DelegationDetailPage />} />
            <Route path="/profile" element={<ProfilePage />} />

            <Route element={<AdminRoute />}>
              <Route path="/admin/rates" element={<AdminRatesPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/company" element={<AdminCompanyPage />} />
              <Route path="/admin/delegations" element={<AdminDelegationsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </>
    </ErrorBoundary>
  );
}
