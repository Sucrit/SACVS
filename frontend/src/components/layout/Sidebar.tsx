import { NavLink } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  ShieldCheck,
  LayoutDashboard, 
  History, 
  Settings,
  BriefcaseBusiness,
  Building2,
  Bell,
} from 'lucide-react';
import logo2 from '../../assets/logo2.png';

interface SidebarProps {
  role: 'STUDENT' | 'ADMIN' | 'EMPLOYER' | 'INSTITUTION';
}

export default function Sidebar({ role }: SidebarProps) {
  const links = {
    STUDENT: [
      { to: '/student', label: 'Home', icon: LayoutDashboard },
      { to: '/student/requests', label: 'Requests', icon: FileText },
      { to: '/student/credentials', label: 'Credentials', icon: ShieldCheck },
      { to: '/student/notifications', label: 'Notifications', icon: Bell },
      { to: '/student/profile', label: 'Profile', icon: Users },
    ],
    INSTITUTION: [
      { to: '/institution', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/institution/students', label: 'Students', icon: Users },
      { to: '/institution/requests', label: 'Requests', icon: FileText },
      { to: '/institution/issue', label: 'Issue Credentials', icon: ShieldCheck },
      { to: '/institution/history', label: 'Audit Logs', icon: History },
      { to: '/institution/notifications', label: 'Notifications', icon: Bell },
    ],
    EMPLOYER: [
      { to: '/employer', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/employer/requests', label: 'My Requests', icon: FileText },
      { to: '/employer/verifications', label: 'Verifications', icon: BriefcaseBusiness },
      { to: '/employer/partners', label: 'Institutions', icon: Building2 },
    ],
    ADMIN: [
      { to: '/admin', label: 'Home', icon: LayoutDashboard },
      { to: '/admin/users', label: 'User Management', icon: Users },
      { to: '/admin/logs', label: 'Audit Logs', icon: FileText },
      { to: '/admin/notifications', label: 'Notifications', icon: FileText },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ]
  };

  const roleLinks = links[role] || links['STUDENT'];

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-56 flex-col overflow-hidden bg-[#f7f7f8]">
      <div className="p-4 pb-3">
        <img alt="Credence logo" className="h-8 w-auto" src={logo2} />
      </div>
      <div className="flex justify-center py-1">
        <div className="h-px w-48 rounded-full bg-slate-300/70" />
      </div>

      <nav className="mt-3 flex-1 space-y-1.5 px-2.5">
        {roleLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === `/${role.toLowerCase()}`}
            className={({ isActive }) =>
              `group relative flex items-center justify-between overflow-hidden rounded-xl px-3 py-2.5 outline-none transition-all duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${
                isActive 
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
              }`
            }
          >
            {() => (
              <div className="relative z-10 flex items-center gap-3">
                <link.icon size={18} />
                <span className="text-[15px] font-medium tracking-wide">{link.label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
