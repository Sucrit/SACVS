import { useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import { useUserRole, UserRole } from '../hooks/useUserRole';
import { useAuth, UserButton } from '@clerk/clerk-react';
import { Bell } from 'lucide-react';
import { api } from '../api/client';

export default function DashboardLayout() {
  const { role, isLoaded } = useUserRole();
  const { getToken } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const setupAuth = async () => {
      const token = await getToken();
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
    };
    setupAuth();
  }, [getToken]);

  if (!isLoaded) {
    return <div className="h-screen flex items-center justify-center bg-gray-50 text-indigo-600 font-medium">Loading session...</div>;
  }

  // Basic role-based access control redirect
  const path = location.pathname;
  if (role === 'STUDENT' && !path.includes('/dashboard/student')) {
      return <Navigate to="/dashboard/student" replace />;
  }
  if (role === 'REGISTRAR' && !path.includes('/dashboard/registrar')) {
      return <Navigate to="/dashboard/registrar" replace />;
  }
  if (role === 'ADMIN' && !path.includes('/dashboard/admin')) {
      return <Navigate to="/dashboard/admin" replace />;
  }

  // Redirect /dashboard to specific role dashboard
  if (path === '/dashboard') {
      return <Navigate to={`/dashboard/${role?.toLowerCase()}`} replace />;
  }

  return (
    <div className="flex bg-gray-50 min-h-screen font-sans text-gray-800">
      <Sidebar role={role as UserRole || 'STUDENT'} />
      
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="bg-white h-16 border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-40">
           <div className="text-sm breadcrumbs text-gray-500">
             SACVS / <span className="font-semibold text-gray-800 uppercase">{role}</span>
           </div>

           <div className="flex items-center gap-6">
              <button className="relative p-2 text-gray-400 hover:text-indigo-600 transition">
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
              </button>
              <div className="h-8 w-px bg-gray-200"></div>
              <UserButton />
           </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}