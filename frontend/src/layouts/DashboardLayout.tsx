import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import Sidebar from '../components/layout/Sidebar';
import { UserRole } from '../services/user.service';
import { NotificationService } from '../services/notification.service';
import { useLegacyAuth } from '../auth/auth-context';

const PAGE_TITLES: Record<UserRole, Array<{ to: string; label: string }>> = {
  STUDENT: [
    { to: '/student/notifications', label: 'Notifications' },
    { to: '/student/requests', label: 'Requests' },
    { to: '/student/credentials', label: 'Credentials' },
    { to: '/student/profile', label: 'Profile' },
    { to: '/student', label: 'Home' },
  ],
  INSTITUTION: [
    { to: '/institution/students', label: 'Students' },
    { to: '/institution/requests', label: 'Requests' },
    { to: '/institution/issue', label: 'Issue Credentials' },
    { to: '/institution/history', label: 'Audit Logs' },
    { to: '/institution/notifications', label: 'Notifications' },
    { to: '/institution', label: 'Dashboard' },
  ],
  EMPLOYER: [
    { to: '/employer/requests', label: 'My Requests' },
    { to: '/employer/verifications', label: 'Verifications' },
    { to: '/employer/partners', label: 'Institutions' },
    { to: '/employer', label: 'Dashboard' },
  ],
  ADMIN: [
    { to: '/admin/users', label: 'User Management' },
    { to: '/admin/logs', label: 'Audit Logs' },
    { to: '/admin/notifications', label: 'Notifications' },
    { to: '/admin/settings', label: 'Settings' },
    { to: '/admin', label: 'Home' },
  ],
};

const resolvePageTitle = (role: UserRole, path: string) => {
  const matches = PAGE_TITLES[role] || [];
  const matched = matches.find(item => path === item.to || path.startsWith(`${item.to}/`));
  if (matched) {
    return matched.label;
  }

  return path
    .split('/')
    .filter(Boolean)
    .pop()
    ?.replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase()) || 'Dashboard';
};

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading } = useLegacyAuth();
  const [studentUnreadNotifications, setStudentUnreadNotifications] = useState(0);

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center bg-white text-slate-700 font-medium">Loading session...</div>;
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
    STUDENT: '/student',
    ADMIN: '/admin',
    EMPLOYER: '/employer',
    INSTITUTION: '/institution',
  };

  const expectedRoutePrefix = roleRoutes[role];
  const path = location.pathname;
  const headerTitle = resolvePageTitle(role, path);
  const welcomeName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const welcomeText = `Welcome, ${welcomeName}`;

  const bellRouteByRole: Record<UserRole, string> = {
    STUDENT: '/student/notifications',
    INSTITUTION: '/institution/notifications',
    ADMIN: '/admin/notifications',
    EMPLOYER: '/employer',
  };
  const bellTargetRoute = bellRouteByRole[role];

  const loadStudentUnreadNotifications = useCallback(async () => {
    if (role !== 'STUDENT') {
      setStudentUnreadNotifications(0);
      return;
    }

    try {
      const unreadCount = await NotificationService.getUnreadCount();
      setStudentUnreadNotifications(unreadCount);
    } catch (error) {
      console.error('Failed to load unread notifications:', error);
    }
  }, [role]);

  useEffect(() => {
    if (role !== 'STUDENT') {
      setStudentUnreadNotifications(0);
      return;
    }

    void loadStudentUnreadNotifications();
    const timer = window.setInterval(() => {
      void loadStudentUnreadNotifications();
    }, 15000);

    return () => window.clearInterval(timer);
  }, [loadStudentUnreadNotifications, role]);

  if (!expectedRoutePrefix) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (!path.startsWith(expectedRoutePrefix)) {
    return <Navigate to={expectedRoutePrefix} replace />;
  }

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-slate-900 selection:text-white">
      <Sidebar role={role} />

      <div className="relative ml-56 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-20 items-center justify-between bg-white px-8">
          <div className="flex flex-col">
            <div className="mb-0.5 text-sm font-medium text-slate-500">{welcomeText}</div>
            <h1 className="text-xl font-semibold text-slate-900">{headerTitle}</h1>
          </div>

          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => navigate(bellTargetRoute)}
              className="relative rounded-full p-2.5 text-slate-500 transition-all duration-300 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Open notifications"
            >
              <Bell size={22} />
              {role === 'STUDENT' && studentUnreadNotifications > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {studentUnreadNotifications > 99 ? '99+' : studentUnreadNotifications}
                </span>
              )}
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <UserButton afterSignOutUrl="/" />
          </div>

          <div className="pointer-events-none absolute bottom-0 left-8 right-8 h-px bg-slate-300/70" />
        </header>

        <main className="flex-1 overflow-y-auto bg-white p-8">
          <div className="mx-auto max-w-7xl space-y-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
