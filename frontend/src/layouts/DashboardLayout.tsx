import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import { UserRole } from '../services/user.service';
import { useLegacyAuth } from '../auth/legacy-auth-context';

export default function DashboardLayout() {
  const location = useLocation();
  const { user, isLoading } = useLegacyAuth();

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center bg-gray-50 text-indigo-600 font-medium">Loading session...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.role === 'STUDENT' && (!user.profile || user.status !== 'APPROVED')) {
    return <Navigate to="/" replace />;
  }

  const role = user.role as UserRole;
  const displayName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
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
    <div className="flex bg-[#F3F4F6] min-h-screen font-sans selection:bg-indigo-500 selection:text-white">
      <Sidebar role={role} />

      <div className="flex-1 ml-72 flex flex-col min-h-screen relative">
        <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-indigo-50 to-transparent -z-10 pointer-events-none"></div>

        <header className="h-20 flex items-center justify-between px-8 sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200/50">
          <div className="flex flex-col">
            <div className="text-xs font-bold text-indigo-600 tracking-wider uppercase mb-0.5">Academic Verification System</div>
            <h1 className="text-xl font-display font-semibold text-gray-800 capitalize">{role.toLowerCase()} Dashboard</h1>
          </div>

          <div className="flex items-center gap-6">
            <button className="relative p-2.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all duration-300">
              <Bell size={22} />
            </button>
            <div className="h-8 w-px bg-gray-200"></div>
            <div className="text-sm font-medium text-slate-700">{displayName || user.email || 'User'}</div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
