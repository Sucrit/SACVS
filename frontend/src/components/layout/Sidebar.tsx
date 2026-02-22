import { NavLink } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  ShieldCheck,
  LayoutDashboard, 
  History, 
  Settings,
  BriefcaseBusiness,
  Building2
} from 'lucide-react';
import logo2 from '../../assets/logo2.png';

interface SidebarProps {
  role: 'STUDENT' | 'ADMIN' | 'EMPLOYER' | 'INSTITUTION';
}

export default function Sidebar({ role }: SidebarProps) {
  const links = {
    STUDENT: [
      { to: '/dashboard/student', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/dashboard/student/requests', label: 'My Requests', icon: FileText },
      { to: '/dashboard/student/credentials', label: 'My Credentials', icon: ShieldCheck },
      { to: '/dashboard/student/profile', label: 'Profile', icon: Users },
    ],
    INSTITUTION: [
      { to: '/dashboard/institution', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/dashboard/institution/requests', label: 'Pending Requests', icon: FileText },
      { to: '/dashboard/institution/verify', label: 'Verify Documents', icon: ShieldCheck },
      { to: '/dashboard/institution/history', label: 'History', icon: History },
    ],
    EMPLOYER: [
      { to: '/dashboard/employer', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/dashboard/employer/requests', label: 'My Requests', icon: FileText },
      { to: '/dashboard/employer/verifications', label: 'Verifications', icon: BriefcaseBusiness },
      { to: '/dashboard/employer/partners', label: 'Institutions', icon: Building2 },
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
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-56 flex-col overflow-hidden border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <img alt="Credence logo" className="h-8 w-auto" src={logo2} />
      </div>

      <nav className="mt-3 flex-1 space-y-1.5 px-2.5">
        {roleLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === `/dashboard/${role.toLowerCase()}`}
            className={({ isActive }) =>
              `group relative flex items-center justify-between overflow-hidden rounded-xl px-3 py-2.5 transition-all duration-200 ${
                isActive 
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <div className="relative z-10 flex items-center gap-3">
              <link.icon size={18} />
              <span className="text-[15px] font-medium tracking-wide">{link.label}</span>
            </div>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
