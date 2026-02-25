import { FormEvent, useEffect, useState } from 'react';
import {
  BookOpen,
  Building2,
  CalendarDays,
  HeartHandshake,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  User as UserIcon,
  UserRound,
} from 'lucide-react';
import Card from '../../../components/common/Card';
import { StudentSex, User } from '../../../services/user.service';

interface StudentProfileSectionProps {
  user: User | null;
  isLoading: boolean;
  onRefresh: () => void;
  onSavePersonalInfo: (payload: {
    phone?: string | null;
    birthday?: string | null;
    sex?: StudentSex | null;
    guardianFullName?: string | null;
    guardianRelationship?: string | null;
  }) => Promise<void>;
  isSavingPersonalInfo: boolean;
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

export default function StudentProfileSection({
  user,
  isLoading,
  onRefresh,
  onSavePersonalInfo,
  isSavingPersonalInfo,
}: StudentProfileSectionProps) {
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [sex, setSex] = useState<StudentSex | ''>('');
  const [guardianFullName, setGuardianFullName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.profile) {
      setPhone('');
      setBirthday('');
      setSex('');
      setGuardianFullName('');
      setGuardianRelationship('');
      return;
    }

    setPhone(user.profile.phone ?? '');
    setBirthday(user.profile.birthday ? user.profile.birthday.slice(0, 10) : '');
    setSex(user.profile.sex ?? '');
    setGuardianFullName(user.profile.guardianFullName ?? '');
    setGuardianRelationship(user.profile.guardianRelationship ?? '');
  }, [user]);

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

  const handleSavePersonalInfo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError(null);
    setSaveHint(null);

    try {
      await onSavePersonalInfo({
        phone: phone.trim() ? phone.trim() : null,
        birthday: birthday.trim() ? birthday.trim() : null,
        sex: sex || null,
        guardianFullName: guardianFullName.trim() ? guardianFullName.trim() : null,
        guardianRelationship: guardianRelationship.trim() ? guardianRelationship.trim() : null,
      });
      setSaveHint('Personal information updated.');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to update personal information.');
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
        <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-6 py-6 md:px-8">
          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-blue-300/20 blur-2xl" />

          <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-4">
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
            <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Student Number</p>
            <p className="mt-1.5 text-sm font-semibold text-slate-900">{valueOrDash(profile?.studentNumber)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
              <Phone size={14} />
              Phone Number
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

      <Card title="Personal & Guardian Information" className="rounded-3xl">
        <form className="space-y-4" onSubmit={handleSavePersonalInfo}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
                <Phone size={14} />
                Contact Number
              </span>
              <input
                type="text"
                value={phone}
                onChange={event => setPhone(event.target.value)}
                placeholder="Enter contact number"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-slate-300"
              />
            </label>

            <label className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
                <CalendarDays size={14} />
                Birthday
              </span>
              <input
                type="date"
                value={birthday}
                onChange={event => setBirthday(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-slate-300"
              />
            </label>

            <label className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
                <UserRound size={14} />
                Sex
              </span>
              <select
                value={sex}
                onChange={event => setSex((event.target.value as StudentSex | '') || '')}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-slate-300"
              >
                <option value="">Select sex</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
                <UserIcon size={14} />
                Guardian Full Name
              </span>
              <input
                type="text"
                value={guardianFullName}
                onChange={event => setGuardianFullName(event.target.value)}
                placeholder="Guardian full name"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-slate-300"
              />
            </label>

            <label className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-slate-500">
                <HeartHandshake size={14} />
                Relationship To Guardian
              </span>
              <input
                type="text"
                value={guardianRelationship}
                onChange={event => setGuardianRelationship(event.target.value)}
                placeholder="e.g. Mother, Father, Aunt"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-slate-300"
              />
            </label>
          </div>

          {saveError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {saveError}
            </div>
          )}
          {saveHint && !saveError && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {saveHint}
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isSavingPersonalInfo}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingPersonalInfo ? 'Saving...' : 'Save Information'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
