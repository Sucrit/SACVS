import {
  BookOpen,
  Building2,
  GraduationCap,
  Hash,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  User as UserIcon,
} from 'lucide-react';
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

const normalizeValue = (value: string | number | null | undefined): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
};

const joinValues = (...values: Array<string | number | null | undefined>) => {
  const parts = values.map(normalizeValue).filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(', ') : '-';
};

export default function StudentProfileSection({ user, isLoading, onRefresh }: StudentProfileSectionProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-48 animate-pulse rounded-3xl border border-slate-200 bg-slate-100" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[1, 2].map(key => (
            <div key={key} className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
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

  const profile = user.profile;
  const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
  const initials = [user.firstName, user.lastName]
    .filter(Boolean)
    .map(part => part.trim().charAt(0).toUpperCase())
    .join('')
    .slice(0, 2);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
        <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-6 py-6 md:px-8">
          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-blue-300/20 blur-2xl" />

          <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/30 bg-white/20 text-lg font-semibold text-white backdrop-blur">
                {initials || '--'}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-300">Student Profile</p>
                <h3 className="mt-1 text-2xl font-semibold leading-tight text-white">{valueOrDash(fullName)}</h3>
                <p className="mt-0.5 text-sm text-slate-200">{valueOrDash(user.email)}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-2 rounded-lg border border-white/35 bg-white/15 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/25"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
              <Hash size={14} />
              Student Number
            </p>
            <p className="mt-1.5 text-sm font-semibold text-slate-900">{valueOrDash(profile?.studentNumber)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
              <Phone size={14} />
              Phone
            </p>
            <p className="mt-1.5 text-sm font-semibold text-slate-900">{valueOrDash(profile?.phone)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
              <BookOpen size={14} />
              Course
            </p>
            <p className="mt-1.5 text-sm font-semibold text-slate-900">{valueOrDash(profile?.courseOfStudy)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
              <Building2 size={14} />
              Department
            </p>
            <p className="mt-1.5 text-sm font-semibold text-slate-900">{valueOrDash(profile?.department)}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Academic Information" className="rounded-3xl">
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
                <BookOpen size={14} />
                Course Of Study
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{valueOrDash(profile?.courseOfStudy)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
                <GraduationCap size={14} />
                Year Level
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{valueOrDash(profile?.yearLevel)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
                <Building2 size={14} />
                Department
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{valueOrDash(profile?.department)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
                <Mail size={14} />
                Email
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{valueOrDash(user.email)}</p>
            </div>
          </div>
        </Card>

        <Card title="Address" className="rounded-3xl">
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
                <MapPin size={14} />
                Full Address
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {joinValues(profile?.street, profile?.barangay, profile?.city, profile?.province)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
                <MapPin size={14} />
                Barangay / City
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {joinValues(profile?.barangay, profile?.city)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
                <MapPin size={14} />
                Province / Zip Code
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {joinValues(profile?.province, profile?.zipCode)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
                <UserIcon size={14} />
                Student Name
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{valueOrDash(fullName)}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
