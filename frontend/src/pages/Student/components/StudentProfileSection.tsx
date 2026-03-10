import { FormEvent, useEffect, useState } from 'react';
import {
  BookOpen,
  Building2,
  CalendarDays,
  GraduationCap,
  HeartHandshake,
  MapPin,
  Phone,
  User as UserIcon,
  UserRound,
} from 'lucide-react';
import Card from '../../../components/common/Card';
import ButtonLoadingContent from '../../../components/common/ButtonLoadingContent';
import { StudentSex, User } from '../../../services/user.service';
import { useToast } from '../../../hooks/useToast';

const PH_LOCAL_PHONE_REGEX = /^9\d{9}$/;
const GUARDIAN_RELATIONSHIP_OPTIONS = [
  'Mother',
  'Father',
  'Guardian',
  'Grandparent',
  'Aunt',
  'Uncle',
  'Sibling',
  'Spouse',
  'Other',
] as const;

const extractLocalPhNumber = (value: string | null | undefined): string => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length >= 12) {
    return digits.slice(2, 12);
  }
  if (digits.startsWith('0') && digits.length >= 11) {
    return digits.slice(1, 11);
  }
  return digits.slice(0, 10);
};

const formatLocalPhNumber = (digits: string): string => {
  const cleaned = digits.replace(/\D/g, '').slice(0, 10);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
};

const valueOrDash = (value: string | number | null | undefined) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : '-';
  }
  if (typeof value === 'number') return String(value);
  return '-';
};

interface StudentProfileSectionProps {
  user: User | null;
  isLoading: boolean;
  onSavePersonalInfo: (payload: {
    street?: string;
    barangay?: string;
    city?: string;
    province?: string;
    zipCode?: number;
    phone?: string | null;
    birthday?: string | null;
    sex?: StudentSex | null;
    guardianFullName?: string | null;
    guardianRelationship?: string | null;
  }) => Promise<void>;
  isSavingPersonalInfo: boolean;
}

export default function StudentProfileSection({
  user,
  isLoading,
  onSavePersonalInfo,
  isSavingPersonalInfo,
}: StudentProfileSectionProps) {
  const { showToast } = useToast();
  const [street, setStreet] = useState('');
  const [barangay, setBarangay] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [birthday, setBirthday] = useState('');
  const [sex, setSex] = useState<StudentSex | ''>('');
  const [guardianFullName, setGuardianFullName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('');
  const [guardianRelationshipCustom, setGuardianRelationshipCustom] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.profile) {
      setStreet('');
      setBarangay('');
      setCity('');
      setProvince('');
      setZipCode('');
      setPhoneLocal('');
      setBirthday('');
      setSex('');
      setGuardianFullName('');
      setGuardianRelationship('');
      setGuardianRelationshipCustom('');
      return;
    }

    setStreet(user.profile.street ?? '');
    setBarangay(user.profile.barangay ?? '');
    setCity(user.profile.city ?? '');
    setProvince(user.profile.province ?? '');
    setZipCode(user.profile.zipCode > 0 ? String(user.profile.zipCode) : '');
    setPhoneLocal(extractLocalPhNumber(user.profile.phone));
    setBirthday(user.profile.birthday ? user.profile.birthday.slice(0, 10) : '');
    setSex(user.profile.sex ?? '');
    setGuardianFullName(user.profile.guardianFullName ?? '');
    const savedRelationship = user.profile.guardianRelationship?.trim() ?? '';
    if (!savedRelationship) {
      setGuardianRelationship('');
      setGuardianRelationshipCustom('');
    } else if (
      GUARDIAN_RELATIONSHIP_OPTIONS.some(option => option !== 'Other' && option === savedRelationship)
    ) {
      setGuardianRelationship(savedRelationship);
      setGuardianRelationshipCustom('');
    } else {
      setGuardianRelationship('Other');
      setGuardianRelationshipCustom(savedRelationship);
    }
  }, [user]);

  if (isLoading) {
    return <div className="h-[560px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />;
  }

  if (!user) {
    return (
      <Card title="Student Profile">
        <p className="text-sm text-neutral-500">No profile data available for this account yet.</p>
      </Card>
    );
  }

  const profile = user.profile;
  const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ').trim();
  const birthdayLocked = Boolean(profile?.birthday);
  const sexLocked = Boolean(profile?.sex);

  const handleSavePersonalInfo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError(null);

    const trimmedStreet = street.trim();
    const trimmedBarangay = barangay.trim();
    const trimmedCity = city.trim();
    const trimmedProvince = province.trim();
    const parsedZipCode = Number(zipCode.trim());
    const cleanedPhoneLocal = phoneLocal.replace(/\D/g, '').slice(0, 10);

    if (!trimmedStreet || !trimmedBarangay || !trimmedCity || !trimmedProvince) {
      setSaveError('Street, barangay, city, and province are required.');
      return;
    }

    if (!Number.isInteger(parsedZipCode) || parsedZipCode <= 0) {
      setSaveError('Zip code is required and must be a positive number.');
      return;
    }

    if (cleanedPhoneLocal.length > 0 && !PH_LOCAL_PHONE_REGEX.test(cleanedPhoneLocal)) {
      setSaveError('Invalid phone format. Enter a valid PH mobile number (e.g. 912 345 6789).');
      return;
    }

    const resolvedGuardianRelationship = guardianRelationship === 'Other'
      ? guardianRelationshipCustom.trim()
      : guardianRelationship.trim();

    try {
      await onSavePersonalInfo({
        street: trimmedStreet,
        barangay: trimmedBarangay,
        city: trimmedCity,
        province: trimmedProvince,
        zipCode: parsedZipCode,
        phone: cleanedPhoneLocal ? `+63${cleanedPhoneLocal}` : null,
        birthday: birthday.trim() ? birthday.trim() : null,
        sex: sex || null,
        guardianFullName: guardianFullName.trim() ? guardianFullName.trim() : null,
        guardianRelationship: resolvedGuardianRelationship ? resolvedGuardianRelationship : null,
      });
      showToast({
        variant: 'success',
        message: 'Student profile updated successfully.',
      });
    } catch (error) {
      showToast({
        variant: 'error',
        message: error instanceof Error ? error.message : 'Unable to update profile information.',
      });
    }
  };

  return (
    <Card
      title="Student Profile"
      className="rounded-lg"
    >
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-neutral-900">{valueOrDash(fullName)}</p>
          <p className="text-sm text-neutral-600">{valueOrDash(user.email)}</p>
        </div>

        <div className="border-t border-neutral-200 pt-6">
          <p className="text-xs font-semibold  text-neutral-500">Academic Information</p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
              <p className="text-xs  text-neutral-500">Student Number</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">{valueOrDash(profile?.studentNumber)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-xs  text-neutral-500">
                <BookOpen size={14} />
                Course
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">{valueOrDash(profile?.courseOfStudy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-xs  text-neutral-500">
                <GraduationCap size={14} />
                Year Level
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">{valueOrDash(profile?.yearLevel)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-xs  text-neutral-500">
                <Building2 size={14} />
                Department
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">{valueOrDash(profile?.department)}</p>
            </div>
          </div>
        </div>

        <form className="space-y-6 border-t border-neutral-200 pt-6" onSubmit={handleSavePersonalInfo}>
          <div>
            <p className="text-xs font-semibold  text-neutral-500">Address Information</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs  text-neutral-500">
                  <MapPin size={14} />
                  Street
                </span>
                <input
                  type="text"
                  value={street}
                  onChange={event => setStreet(event.target.value)}
                  placeholder="Street"
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-800 outline-none focus:border-neutral-300"
                />
              </label>
              <label className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs  text-neutral-500">
                  <MapPin size={14} />
                  Barangay
                </span>
                <input
                  type="text"
                  value={barangay}
                  onChange={event => setBarangay(event.target.value)}
                  placeholder="Barangay"
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-800 outline-none focus:border-neutral-300"
                />
              </label>
              <label className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs  text-neutral-500">
                  <MapPin size={14} />
                  City
                </span>
                <input
                  type="text"
                  value={city}
                  onChange={event => setCity(event.target.value)}
                  placeholder="City"
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-800 outline-none focus:border-neutral-300"
                />
              </label>
              <label className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs  text-neutral-500">
                  <MapPin size={14} />
                  Province
                </span>
                <input
                  type="text"
                  value={province}
                  onChange={event => setProvince(event.target.value)}
                  placeholder="Province"
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-800 outline-none focus:border-neutral-300"
                />
              </label>
              <label className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs  text-neutral-500">
                  <MapPin size={14} />
                  Zip Code
                </span>
                <input
                  type="number"
                  min={1}
                  value={zipCode}
                  onChange={event => setZipCode(event.target.value)}
                  placeholder="Zip code"
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-800 outline-none focus:border-neutral-300"
                />
              </label>
            </div>
          </div>

          <div className="border-t border-neutral-200 pt-6">
            <p className="text-xs font-semibold  text-neutral-500">Personal Information</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs  text-neutral-500">
                  <Phone size={14} />
                  Contact Number
                </span>
                <div className="flex h-10 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 focus-within:border-neutral-300">
                  <div className="inline-flex items-center border-r border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700">
                    <span>+63</span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatLocalPhNumber(phoneLocal)}
                    onChange={event => setPhoneLocal(event.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="912 345 6789"
                    className="h-full w-full bg-transparent px-3 text-sm text-neutral-800 outline-none"
                  />
                </div>
              </label>

              <label className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs  text-neutral-500">
                  <CalendarDays size={14} />
                  Birthday
                </span>
                <input
                  type="date"
                  value={birthday}
                  onChange={event => setBirthday(event.target.value)}
                  disabled={birthdayLocked}
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-800 outline-none focus:border-neutral-300 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
                />
              </label>

              <label className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs  text-neutral-500">
                  <UserRound size={14} />
                  Sex
                </span>
                <select
                  value={sex}
                  onChange={event => setSex((event.target.value as StudentSex | '') || '')}
                  disabled={sexLocked}
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-800 outline-none focus:border-neutral-300 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
                >
                  <option value="">Select sex</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs  text-neutral-500">
                  <UserIcon size={14} />
                  Guardian Full Name
                </span>
                <input
                  type="text"
                  value={guardianFullName}
                  onChange={event => setGuardianFullName(event.target.value)}
                  placeholder="Guardian full name"
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-800 outline-none focus:border-neutral-300"
                />
              </label>

              <label className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs  text-neutral-500">
                  <HeartHandshake size={14} />
                  Relationship to Guardian
                </span>
                <select
                  value={guardianRelationship}
                  onChange={event => setGuardianRelationship(event.target.value)}
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-800 outline-none focus:border-neutral-300"
                >
                  <option value="">Select relationship</option>
                  {GUARDIAN_RELATIONSHIP_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              {guardianRelationship === 'Other' && (
                <label className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 text-xs  text-neutral-500">
                    <HeartHandshake size={14} />
                    Other Relationship
                  </span>
                  <input
                    type="text"
                    value={guardianRelationshipCustom}
                    onChange={event => setGuardianRelationshipCustom(event.target.value)}
                    placeholder="Specify relationship"
                    className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-800 outline-none focus:border-neutral-300"
                  />
                </label>
              )}
            </div>
          </div>

          {saveError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {saveError}
            </div>
          )}
          <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
            <button
              type="submit"
              disabled={isSavingPersonalInfo}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-900 bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingPersonalInfo ? <ButtonLoadingContent label="Saving" /> : 'Save Information'}
            </button>
          </div>
        </form>
      </div>
    </Card>
  );
}
