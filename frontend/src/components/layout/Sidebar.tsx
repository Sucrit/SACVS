import React from 'react';
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
import { useClerk } from '@clerk/clerk-react';

interface SidebarProps {
  role: 'STUDENT' | 'REGISTRAR' | 'ADMIN';
}

export default function Sidebar({ role }: SidebarProps) {
  const { signOut } = useClerk();

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
    <div className="w-64 bg-gray-900 text-gray-300 flex flex-col h-screen fixed left-0 top-0 overflow-y-auto">
      <div className="p-6 border-b border-gray-800">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="text-indigo-500" />
          SACVS
        </h2>
        <span className="text-xs font-mono text-gray-500 uppercase mt-1 block tracking-wider">{role} PORTAL</span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {roleLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === `/dashboard/${role.toLowerCase()}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <link.icon size={20} />
            <span className="font-medium">{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button 
          onClick={() => signOut()} 
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg hover:bg-red-900/20 hover:text-red-400 transition-colors text-left"
        >
          <LogOut size={20} />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );
}