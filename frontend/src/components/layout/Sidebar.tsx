import { NavLink } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  ShieldCheck, 
  LayoutDashboard, 
  History, 
  Settings
} from 'lucide-react';

interface SidebarProps {
  role: 'STUDENT' | 'REGISTRAR' | 'ADMIN';
}

export default function Sidebar({ role }: SidebarProps) {
  const links = {
    STUDENT: [
      { to: '/dashboard/student', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/dashboard/student/requests', label: 'My Requests', icon: FileText },
      { to: '/dashboard/student/credentials', label: 'My Credentials', icon: ShieldCheck },
      { to: '/dashboard/student/profile', label: 'Profile', icon: Users },
    ],
    REGISTRAR: [
      { to: '/dashboard/registrar', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/dashboard/registrar/requests', label: 'Pending Requests', icon: FileText },
      { to: '/dashboard/registrar/verify', label: 'Verify Documents', icon: ShieldCheck },
      { to: '/dashboard/registrar/history', label: 'History', icon: History },
    ],
    ADMIN: [
      { to: '/dashboard/admin', label: 'Overview', icon: LayoutDashboard },
      { to: '/dashboard/admin/users', label: 'User Management', icon: Users },
      { to: '/dashboard/admin/logs', label: 'System Logs', icon: FileText },
      { to: '/dashboard/admin/settings', label: 'Settings', icon: Settings },
    ]
  };

  const roleLinks = links[role] || links['STUDENT'];

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-72 flex-col overflow-hidden border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-8 pb-6">
        <div className="mb-1 flex items-center gap-3">
          <div className="rounded-xl bg-slate-900 p-2 shadow-sm">
            <ShieldCheck className="text-white" size={24} />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Credence
          </h2>
        </div>
        <div className="ml-12">
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
            {role} PORTAL
          </span>
        </div>
      </div>

      <nav className="mt-4 flex-1 space-y-2 px-4">
        {roleLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === `/dashboard/${role.toLowerCase()}`}
            className={({ isActive }) =>
              `group relative flex items-center justify-between overflow-hidden rounded-xl px-4 py-3.5 transition-all duration-200 ${
                isActive 
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <div className="relative z-10 flex items-center gap-3">
              <link.icon size={20} />
              <span className="font-medium tracking-wide">{link.label}</span>
            </div>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
