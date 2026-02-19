import { NavLink } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  ShieldCheck, 
  LayoutDashboard, 
  History, 
  Settings,
  LogOut
} from 'lucide-react';
import { useLegacyAuth } from '../../auth/legacy-auth-context';

interface SidebarProps {
  role: 'STUDENT' | 'REGISTRAR' | 'ADMIN';
}

export default function Sidebar({ role }: SidebarProps) {
  const { logout } = useLegacyAuth();

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
    <aside className="w-72 glass-dark text-slate-300 flex flex-col h-screen fixed left-0 top-0 overflow-hidden border-r border-slate-700/50 shadow-2xl z-50">
      <div className="p-8 pb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-gradient-to-tr from-indigo-500 to-violet-500 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="text-white" size={24} />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight font-display">
            Credence
          </h2>
        </div>
        <div className="ml-12">
          <span className="text-[10px] font-bold tracking-[0.2em] text-indigo-400 uppercase bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
            {role} PORTAL
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {roleLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === `/dashboard/${role.toLowerCase()}`}
            className={({ isActive }) =>
              `group flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-300 ease-in-out relative overflow-hidden ${
                isActive 
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-900/20 translate-x-1' 
                  : 'hover:bg-slate-800/50 hover:text-white hover:translate-x-1 text-slate-400'
              }`
            }
          >
            <div className="flex items-center gap-3 relative z-10">
              <link.icon size={20} className={`transition-transform duration-300 ${""/*isActive ? 'scale-110' : 'group-hover:scale-110'*/}`} />
              <span className="font-medium tracking-wide">{link.label}</span>
            </div>
            {/* {isActive && <ChevronRight size={16} className="text-indigo-200 animate-pulse" />} */}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 m-4 rounded-2xl bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-slate-700/50">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-1.5 bg-yellow-500/10 rounded-lg">
             <ShieldCheck size={16} className="text-yellow-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-200">Secure Status</p>
            <p className="text-[10px] text-slate-500 mt-0.5">System Online & Protected</p>
          </div>
        </div>
        
        <button 
          onClick={logout} 
          className="flex items-center justify-center gap-2 px-4 py-2.5 w-full rounded-xl bg-slate-800 text-slate-300 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 border border-transparent transition-all text-sm font-medium mt-2"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
