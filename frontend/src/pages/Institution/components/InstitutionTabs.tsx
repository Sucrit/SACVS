import { Link } from 'react-router-dom';
import { Bell, ClipboardCheck, FileText, History, ShieldCheck, ShieldAlert, UserPlus } from 'lucide-react';
import { InstitutionSection } from '../types';

interface InstitutionTabsProps {
  section: InstitutionSection;
}

const TAB_LINKS: Array<{ to: string; key: InstitutionSection; label: string; icon: typeof FileText }> = [
  { to: '/institution', key: 'overview', label: 'Dashboard', icon: FileText },
  { to: '/institution/students', key: 'students', label: 'Students', icon: UserPlus },
  { to: '/institution/requests', key: 'requests', label: 'Requests', icon: ClipboardCheck },
  { to: '/institution/verify', key: 'verify', label: 'Verify & Issue', icon: ShieldCheck },
  { to: '/institution/history', key: 'history', label: 'Audit Logs', icon: History },
];

export default function InstitutionTabs({ section }: InstitutionTabsProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {TAB_LINKS.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
              section === link.key
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <link.icon size={13} />
            {link.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Link
          to="/institution/notifications"
          className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
            section === 'notifications'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Bell size={13} />
          Notifications
        </Link>
        <div className="col-span-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
          <ShieldAlert size={13} />
          Frontend mode: some actions are staged in UI while backend endpoints are being implemented.
        </div>
      </div>
    </>
  );
}
