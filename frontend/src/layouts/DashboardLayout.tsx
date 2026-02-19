import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import Sidebar from '../components/layout/Sidebar';
import { UserRole } from '../services/user.service';
import { useLegacyAuth } from '../auth/auth-context';

export default function DashboardLayout() {
  const location = useLocation();
  const { user, isLoading } = useLegacyAuth();

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center bg-[#f7f7f8] text-slate-700 font-medium">Loading session...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.status !== 'APPROVED') {
    return <Navigate to="/" replace />;
  }

  if (user.role === 'STUDENT' && !user.profile) {
    return <Navigate to="/" replace />;
  }

  const role = user.role as UserRole;
  const roleRoutes: Record<UserRole, string> = {
    STUDENT: '/dashboard/student',
    REGISTRAR: '/dashboard/registrar',
    ADMIN: '/dashboard/admin',
  };

  const expectedRoutePrefix = roleRoutes[role];
  const path = location.pathname;

  if (path === '/dashboard') {
    return <Navigate to={expectedRoutePrefix} replace />;
  }

  if (!path.startsWith(expectedRoutePrefix)) {
    return <Navigate to={expectedRoutePrefix} replace />;
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] font-sans selection:bg-slate-900 selection:text-white">
      <Sidebar role={role} />

      <div className="relative ml-72 flex min-h-screen flex-1 flex-col">
        <div className="pointer-events-none absolute left-0 top-0 -z-10 h-[260px] w-full bg-gradient-to-b from-slate-100 to-transparent"></div>

        <header className="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-8 backdrop-blur-md">
          <div className="flex flex-col">
            <div className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Academic Verification System</div>
            <h1 className="text-xl font-semibold capitalize text-slate-900">{role.toLowerCase()} Dashboard</h1>
          </div>

          <div className="flex items-center gap-6">
            <button className="relative rounded-full p-2.5 text-slate-500 transition-all duration-300 hover:bg-slate-100 hover:text-slate-900">
              <Bell size={22} />
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-7xl space-y-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
