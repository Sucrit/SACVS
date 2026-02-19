import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  SignIn,
  SignUp,
  SignedIn,
  SignedOut,
  useUser,
} from '@clerk/clerk-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLegacyAuth } from '../auth/auth-context';
import {
  CompleteStudentOnboardingPayload,
  UpsertStudentProfilePayload,
  User,
  UserService,
} from '../services/user.service';

type AuthMode = 'signin' | 'signup';
type SignupStep = 1 | 2 | 3;

const initialProfileForm: UpsertStudentProfilePayload = {
  studentNumber: '',
  street: '',
  barangay: '',
  city: '',
  province: '',
  zipCode: 0,
  phone: '',
  courseOfStudy: '',
  yearLevel: '',
  department: '',
};

const departmentOptions = [
  'Computer Science & AI',
  'Information Technology',
  'Electrical Engineering',
  'Business Administration',
  'Mathematics',
  'Physics',
];

const courseOptions = [
  'BS Computer Science',
  'BS Information Technology',
  'BS Information Systems',
  'BS Computer Engineering',
  'BS Cybersecurity',
  'BS Data Science',
];

const yearLevelOptions = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year',
  'Postgraduate',
];

const mapProfileToForm = (user: User): UpsertStudentProfilePayload => ({
  studentNumber: user.profile?.studentNumber ?? '',
  street: user.profile?.street ?? '',
  barangay: user.profile?.barangay ?? '',
  city: user.profile?.city ?? '',
  province: user.profile?.province ?? '',
  zipCode: user.profile?.zipCode ?? 0,
  phone: user.profile?.phone ?? '',
  courseOfStudy: user.profile?.courseOfStudy ?? '',
  yearLevel: user.profile?.yearLevel ?? '',
  department: user.profile?.department ?? '',
});

function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8.57829 8.57829C5.52816 11.6284 3.451 15.5145 2.60947 19.7452C1.76794 23.9758 2.19984 28.361 3.85056 32.3462C5.50128 36.3314 8.29667 39.7376 11.8832 42.134C15.4698 44.5305 19.6865 45.8096 24 45.8096C28.3135 45.8096 32.5302 44.5305 36.1168 42.134C39.7033 39.7375 42.4987 36.3314 44.1494 32.3462C45.8002 28.361 46.2321 23.9758 45.3905 19.7452C44.549 15.5145 42.4718 11.6284 39.4217 8.57829L24 24L8.57829 8.57829Z"
        fill="currentColor"
      ></path>
    </svg>
  );
}

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const clerkAppearance = {
  elements: {
    rootBox: 'w-full',
    card: 'w-full max-w-[520px] border border-slate-200 shadow-none',
    headerTitle: 'text-slate-900',
    formButtonPrimary: 'bg-slate-900 hover:bg-black text-white',
    footerAction: 'hidden',
    formFieldInput: 'border-slate-200',
  },
};

export default function AuthPage() {
  const navigate = useNavigate();
  const { mode } = useParams<{ mode: string }>();
  const { user: clerkUser, isLoaded: isClerkLoaded, isSignedIn } = useUser();
  const { refreshUser } = useLegacyAuth();

  const normalizedMode: AuthMode = mode === 'signin' || mode === 'signup' ? mode : 'signup';
  const [authMode, setAuthMode] = useState<AuthMode>(normalizedMode);
  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileForm, setProfileForm] = useState<UpsertStudentProfilePayload>(initialProfileForm);
  const [confirmVerification, setConfirmVerification] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authHint, setAuthHint] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onboardingSubmitted, setOnboardingSubmitted] = useState(false);
  const [isHydratingSignup, setIsHydratingSignup] = useState(false);

  useEffect(() => {
    setAuthMode(normalizedMode);
    setAuthError(null);
    setAuthHint(null);
    setOnboardingSubmitted(false);
    setIsHydratingSignup(false);

    if (normalizedMode !== 'signup') {
      setSignupStep(1);
    }
  }, [normalizedMode]);

  useEffect(() => {
    if (!isClerkLoaded || !isSignedIn || !clerkUser || authMode !== 'signup') {
      return;
    }

    let isCancelled = false;
    const hydrateSignupData = async () => {
      setIsHydratingSignup(true);
      setAuthError(null);

      try {
        const localUser = await refreshUser();
        if (isCancelled) {
          return;
        }

        if (localUser?.status === 'APPROVED') {
          navigate('/dashboard', { replace: true });
          return;
        }

        if (localUser) {
          setFirstName(localUser.firstName || clerkUser.firstName || '');
          setMiddleName(localUser.middleName || '');
          setLastName(localUser.lastName || clerkUser.lastName || '');
          setProfileForm(mapProfileToForm(localUser));
          setSignupStep(2);

          if (localUser.profile) {
            setAuthHint('Loaded your saved student profile from your previous submission.');
          } else {
            setAuthHint(null);
          }
          return;
        }

        setFirstName(clerkUser.firstName ?? '');
        setMiddleName('');
        setLastName(clerkUser.lastName ?? '');
        setProfileForm(initialProfileForm);
        setSignupStep(2);
        setAuthHint(null);
      } catch (error) {
        console.error('Failed to hydrate signup data:', error);
        if (!isCancelled) {
          setAuthError('Unable to load your saved onboarding data right now.');
        }
      } finally {
        if (!isCancelled) {
          setIsHydratingSignup(false);
        }
      }
    };

    void hydrateSignupData();

    return () => {
      isCancelled = true;
    };
  }, [authMode, clerkUser, isClerkLoaded, isSignedIn, navigate, refreshUser]);

  useEffect(() => {
    if (!isClerkLoaded || !isSignedIn || authMode !== 'signin') {
      return;
    }

    const syncAndRoute = async () => {
      setAuthError(null);
      try {
        const localUser = await refreshUser();

        if (!localUser) {
          navigate('/auth/signup', { replace: true });
          return;
        }

        if (localUser.status === 'APPROVED') {
          navigate('/dashboard', { replace: true });
          return;
        }

        setAuthHint('Account found, but it is not approved yet.');
        navigate('/', { replace: true });
      } catch (error) {
        console.error('Failed to validate account after sign-in:', error);
        setAuthError('Unable to validate your account right now. Please try again.');
      }
    };

    void syncAndRoute();
  }, [authMode, isClerkLoaded, isSignedIn, navigate, refreshUser]);

  const currentEmail = useMemo(() => {
    if (!clerkUser) {
      return '';
    }

    return (
      clerkUser.emailAddresses.find(entry => entry.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      ''
    );
  }, [clerkUser]);

  const validateStepTwo = () => {
    if (!firstName.trim()) {
      return 'First name is required.';
    }

    if (!lastName.trim()) {
      return 'Last name is required.';
    }

    const payload = {
      ...profileForm,
      studentNumber: profileForm.studentNumber.trim(),
      street: profileForm.street.trim(),
      barangay: profileForm.barangay.trim(),
      city: profileForm.city.trim(),
      province: profileForm.province.trim(),
      phone: profileForm.phone.trim(),
      courseOfStudy: profileForm.courseOfStudy.trim(),
      yearLevel: profileForm.yearLevel.trim(),
      department: profileForm.department.trim(),
      zipCode: Number(profileForm.zipCode),
    };

    const hasMissingProfile =
      payload.studentNumber.length === 0 ||
      payload.street.length === 0 ||
      payload.barangay.length === 0 ||
      payload.city.length === 0 ||
      payload.province.length === 0 ||
      !Number.isInteger(payload.zipCode) ||
      payload.zipCode <= 0 ||
      payload.phone.length === 0 ||
      payload.courseOfStudy.length === 0 ||
      payload.yearLevel.length === 0 ||
      payload.department.length === 0;

    if (hasMissingProfile) {
      return 'Complete all required profile fields.';
    }

    return null;
  };

  const handleStepTwoContinue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);

    const validationError = validateStepTwo();
    if (validationError) {
      setAuthError(validationError);
      return;
    }

    setSignupStep(3);
  };

  const handleFinalizeOnboarding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setAuthHint(null);

    if (!confirmVerification) {
      setAuthError('Confirm your details before submitting.');
      return;
    }

    const validationError = validateStepTwo();
    if (validationError) {
      setAuthError(validationError);
      setSignupStep(2);
      return;
    }

    if (!isSignedIn) {
      setAuthError('Authentication session expired. Please authenticate again.');
      setSignupStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CompleteStudentOnboardingPayload = {
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
        lastName: lastName.trim(),
        studentNumber: profileForm.studentNumber.trim(),
        street: profileForm.street.trim(),
        barangay: profileForm.barangay.trim(),
        city: profileForm.city.trim(),
        province: profileForm.province.trim(),
        zipCode: Number(profileForm.zipCode),
        phone: profileForm.phone.trim(),
        courseOfStudy: profileForm.courseOfStudy.trim(),
        yearLevel: profileForm.yearLevel.trim(),
        department: profileForm.department.trim(),
      };

      await UserService.completeStudentOnboarding(payload);
      await refreshUser();

      setOnboardingSubmitted(true);
      setAuthHint('Your account creation request is now pending admin/registrar approval.');
    } catch (error) {
      console.error('Failed to submit onboarding:', error);
      setAuthError('Unable to submit onboarding. Please review your inputs and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const step = authMode === 'signup' ? signupStep : 1;
  const isClerkAuthStep =
    authMode === 'signin' || (authMode === 'signup' && (signupStep === 1 || isHydratingSignup));

  return (
    <div className="credence-font min-h-screen bg-[#f7f7f8] px-4 py-8 text-slate-900 antialiased sm:px-6">
      <div className="mx-auto mb-8 flex w-full max-w-[960px] items-center justify-between">
        <Link className="flex items-center gap-3 text-slate-900" to="/">
          <Logo className="h-8 w-8" />
          <span className="text-xl font-extrabold tracking-tight">credence</span>
        </Link>
        <Link
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          to="/"
        >
          Back to Home
        </Link>
      </div>

      <div className="mx-auto mb-5 w-full max-w-[560px]">
        <div className="mx-auto flex w-full max-w-[460px] items-center gap-2 px-1 md:px-2">
          <div className="flex flex-col items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-full border text-xs font-semibold ${
                step >= 1 ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-400'
              }`}
            >
              {step > 1 ? <Icon className="text-sm" name="check" /> : 1}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${step >= 1 ? 'text-slate-900' : 'text-slate-400'}`}>
              Account
            </span>
          </div>
          <div className={`h-px flex-1 ${step >= 2 ? 'bg-slate-400' : 'bg-slate-200'}`}></div>
          <div className="flex flex-col items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-full border text-xs font-semibold ${
                step >= 2 ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-400'
              }`}
            >
              {step > 2 ? <Icon className="text-sm" name="check" /> : 2}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${step >= 2 ? 'text-slate-900' : 'text-slate-400'}`}>
              Profile
            </span>
          </div>
          <div className={`h-px flex-1 ${step >= 3 ? 'bg-slate-400' : 'bg-slate-200'}`}></div>
          <div className="flex flex-col items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-full border text-xs font-semibold ${
                step >= 3 ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-400'
              }`}
            >
              3
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${step >= 3 ? 'text-slate-900' : 'text-slate-400'}`}>
              Verify
            </span>
          </div>
        </div>
      </div>

      <div
        className={
          isClerkAuthStep
            ? 'mx-auto w-full max-w-[520px]'
            : 'mx-auto w-full max-w-[760px] rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] md:p-8'
        }
      >
        {isClerkAuthStep && !isClerkLoaded && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent"></div>
              <p className="font-medium">Loading authentication...</p>
            </div>
          </div>
        )}

        {isClerkLoaded && authMode === 'signup' && isHydratingSignup && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent"></div>
              <p className="font-medium">Loading your previously submitted student profile...</p>
            </div>
          </div>
        )}

        {isClerkLoaded && authMode === 'signup' && signupStep === 1 && !isHydratingSignup && (
          <div className="space-y-4">
            <SignedOut>
              <div className="flex justify-center">
                <SignUp
                  routing="path"
                  path="/auth/signup"
                  signInUrl="/auth/signin"
                  forceRedirectUrl="/auth/signup"
                  fallbackRedirectUrl="/auth/signup"
                  oauthFlow="redirect"
                  appearance={clerkAppearance}
                />
              </div>
            </SignedOut>
            <SignedIn>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent"></div>
                  <p className="font-medium">Authentication complete. Proceeding to Step 2...</p>
                </div>
              </div>
            </SignedIn>
          </div>
        )}

        {isClerkLoaded && authMode === 'signin' && (
          <div className="space-y-4">
            <SignedOut>
              <div className="flex justify-center">
                <SignIn
                  routing="path"
                  path="/auth/signin"
                  signUpUrl="/auth/signup"
                  forceRedirectUrl="/auth/signin"
                  fallbackRedirectUrl="/auth/signin"
                  oauthFlow="redirect"
                  appearance={clerkAppearance}
                />
              </div>
            </SignedOut>
            <SignedIn>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent"></div>
                  <p className="font-medium">Authentication complete. Validating account access...</p>
                </div>
              </div>
            </SignedIn>
          </div>
        )}

        {authMode === 'signup' && signupStep === 2 && (
          <form className="space-y-6" onSubmit={handleStepTwoContinue}>
            <div className="space-y-1 text-center">
              <h3 className="text-2xl font-bold tracking-tight text-slate-900">Complete Your Student Profile</h3>
              <p className="text-sm text-slate-500">Fill in all required details before verification.</p>
              {currentEmail && <p className="text-xs text-slate-500">Authenticated email: {currentEmail}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">First Name</label>
                <input
                  required
                  value={firstName}
                  onChange={event => setFirstName(event.target.value)}
                  placeholder="First Name"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">Middle Name</label>
                <input
                  value={middleName}
                  onChange={event => setMiddleName(event.target.value)}
                  placeholder="Middle Name (Optional)"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">Last Name</label>
                <input
                  required
                  value={lastName}
                  onChange={event => setLastName(event.target.value)}
                  placeholder="Last Name"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600">Student Number</label>
              <input
                required
                value={profileForm.studentNumber}
                onChange={event => setProfileForm(prev => ({ ...prev, studentNumber: event.target.value }))}
                placeholder="e.g. 03-2226-123456"
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">Phone Number</label>
                <input
                  required
                  value={profileForm.phone}
                  onChange={event => setProfileForm(prev => ({ ...prev, phone: event.target.value }))}
                  placeholder="+63 912 345 6789"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">Department</label>
                <select
                  required
                  value={profileForm.department}
                  onChange={event => setProfileForm(prev => ({ ...prev, department: event.target.value }))}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                >
                  <option value="">Select Department</option>
                  {departmentOptions.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">Course of Study</label>
                <select
                  required
                  value={profileForm.courseOfStudy}
                  onChange={event => setProfileForm(prev => ({ ...prev, courseOfStudy: event.target.value }))}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                >
                  <option value="">Select Course of Study</option>
                  {courseOptions.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">Year Level</label>
                <select
                  required
                  value={profileForm.yearLevel}
                  onChange={event => setProfileForm(prev => ({ ...prev, yearLevel: event.target.value }))}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                >
                  <option value="">Select Year Level</option>
                  {yearLevelOptions.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">Street</label>
                <input
                  required
                  value={profileForm.street}
                  onChange={event => setProfileForm(prev => ({ ...prev, street: event.target.value }))}
                  placeholder="Street"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">Barangay</label>
                <input
                  required
                  value={profileForm.barangay}
                  onChange={event => setProfileForm(prev => ({ ...prev, barangay: event.target.value }))}
                  placeholder="Barangay"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">City</label>
                <input
                  required
                  value={profileForm.city}
                  onChange={event => setProfileForm(prev => ({ ...prev, city: event.target.value }))}
                  placeholder="City"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">Province</label>
                <input
                  required
                  value={profileForm.province}
                  onChange={event => setProfileForm(prev => ({ ...prev, province: event.target.value }))}
                  placeholder="Province"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600">Zip Code</label>
              <input
                required
                type="number"
                min={1}
                value={profileForm.zipCode || ''}
                onChange={event =>
                  setProfileForm(prev => ({
                    ...prev,
                    zipCode: Number.isNaN(event.target.valueAsNumber) ? 0 : event.target.valueAsNumber,
                  }))
                }
                placeholder="Zip Code"
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
              />
            </div>

            {authError && <p className="text-sm text-rose-700">{authError}</p>}
            {authHint && <p className="text-sm text-slate-600">{authHint}</p>}

            <div className="flex flex-col items-center gap-3 border-t border-slate-100 pt-4 sm:flex-row">
              <button
                type="button"
                onClick={() => setSignupStep(1)}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 sm:w-auto"
              >
                <Icon className="text-base" name="arrow_back" />
                Back
              </button>
              <button
                type="submit"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-black"
              >
                Continue to Verify
                <Icon className="text-base" name="arrow_forward" />
              </button>
            </div>
          </form>
        )}

        {authMode === 'signup' && signupStep === 3 && (
          <form className="space-y-6" onSubmit={handleFinalizeOnboarding}>
            <div className="space-y-1 text-center">
              <h3 className="text-2xl font-bold tracking-tight text-slate-900">Verify and Submit</h3>
              <p className="text-sm text-slate-500">
                Final check before creating your pending account request.
              </p>
            </div>

            {onboardingSubmitted ? (
              <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
                <p className="text-base font-semibold">Account creation request submitted.</p>
                <p>
                  Your account is now <span className="font-semibold">PENDING</span> and must be approved by admin
                  or registrar before dashboard access is enabled.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-black"
                    to="/"
                  >
                    Back to Home
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold">Name:</span> {firstName} {middleName} {lastName}
                  </p>
                  <p>
                    <span className="font-semibold">Email:</span> {currentEmail || 'No email found'}
                  </p>
                  <p>
                    <span className="font-semibold">Student Number:</span> {profileForm.studentNumber}
                  </p>
                  <p>
                    <span className="font-semibold">Course/Year:</span> {profileForm.courseOfStudy} / {profileForm.yearLevel}
                  </p>
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={confirmVerification}
                    onChange={event => setConfirmVerification(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                  <span>
                    I confirm these details are accurate and understand my account remains pending until admin and registrar approval.
                  </span>
                </label>

                {authError && <p className="text-sm text-rose-700">{authError}</p>}
                {authHint && <p className="text-sm text-slate-600">{authHint}</p>}

                <div className="flex flex-col items-center gap-3 border-t border-slate-100 pt-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setSignupStep(2)}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 sm:w-auto"
                  >
                    <Icon className="text-base" name="arrow_back" />
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
                    <Icon className="text-base" name="send" />
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {authError && isClerkAuthStep && <p className="mt-4 text-sm text-rose-700">{authError}</p>}
      </div>
    </div>
  );
}
