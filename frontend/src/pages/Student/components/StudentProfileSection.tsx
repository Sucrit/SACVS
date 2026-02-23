import { RefreshCw } from 'lucide-react';
import Card from '../../../components/common/Card';
import { User } from '../../../services/user.service';

interface StudentProfileSectionProps {
  user: User | null;
  isLoading: boolean;
  onRefresh: () => void;
}

const valueOrDash = (value: string | number | null | undefined) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : '-';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return '-';
};

export default function StudentProfileSection({ user, isLoading, onRefresh }: StudentProfileSectionProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[1, 2, 3, 4].map(key => (
          <div key={key} className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <Card
        title="Student Profile"
        action={(
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        )}
      >
        <p className="text-sm text-slate-500">No profile data available for this account yet.</p>
      </Card>
    );
  }

  const profile = user.profile ?? null;
  const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');

  return (
    <div className="space-y-6">
      <Card
        title="Student Profile"
        action={(
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        )}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Full Name</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{valueOrDash(fullName)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Email</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{valueOrDash(user.email)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Student Number</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{valueOrDash(profile?.studentNumber)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Phone</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{valueOrDash(profile?.phone)}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Academic Information">
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Course Of Study</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{valueOrDash(profile?.courseOfStudy)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Year Level</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{valueOrDash(profile?.yearLevel)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Department</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{valueOrDash(profile?.department)}</p>
            </div>
          </div>
        </Card>

        <Card title="Address">
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Street</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{valueOrDash(profile?.street)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Barangay / City</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {`${valueOrDash(profile?.barangay)}, ${valueOrDash(profile?.city)}`}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Province / Zip Code</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {`${valueOrDash(profile?.province)}, ${valueOrDash(profile?.zipCode)}`}
              </p>
            </div>
          </div>
        </Card>
      </div>

    </div>
  );
}
