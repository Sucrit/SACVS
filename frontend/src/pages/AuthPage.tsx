import { FormEvent, memo, useCallback, useEffect, useMemo, useState } from 'react';
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
  CompleteOrganizationOnboardingPayload,
  OrganizationRole,
  UserRole,
  User,
  UserService,
} from '../services/user.service';
import ButtonLoadingContent from '../components/common/ButtonLoadingContent';
import logo2 from '../assets/logo2.png';
import heroBg from '../assets/hero_bg.jpg';
import { useToast } from '../hooks/useToast';
import { toErrorMessage } from '../utils/toast-message';

type AuthMode = 'signin' | 'signup';
const SIGNUP_ROLE_STORAGE_KEY = 'sacvs.signup.role';

const ROLE_HOME_ROUTES: Record<UserRole, string> = {
  STUDENT: '/student',
  ADMIN: '/admin',
  INSTITUTION: '/institution',
};

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const clerkAppearance = {
  elements: {
    rootBox: 'w-full',
    card: 'w-full max-w-[520px] border border-neutral-200 shadow-none',
    headerTitle: 'text-neutral-900',
    formButtonPrimary: 'bg-neutral-900 hover:bg-black text-white',
    footerAction: 'hidden',
    formFieldInput: 'border-neutral-200',
  },
};

const signInClerkAppearance = {
  elements: {
    ...clerkAppearance.elements,
    card: 'w-full max-w-[520px] border border-neutral-200 shadow-none',
  },
};

const SignInBrand = memo(function SignInBrand() {
  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col items-center text-center">
      <img alt="Credence logo" className="h-20 w-auto md:h-24" loading="eager" src={logo2} />
      <p className="mt-5 text-xl leading-relaxed text-neutral-600 md:text-2xl">
        Access your credentials anywhere, and manage records with confidence.
      </p>
    </div>
  );
});

export default function AuthPage() {
  const navigate = useNavigate();
  const { mode } = useParams<{ mode: string }>();
  const { user: clerkUser, isLoaded: isClerkLoaded, isSignedIn } = useUser();
  const { refreshUser, user: localSessionUser } = useLegacyAuth();
  const { showToast } = useToast();

  const normalizedMode: AuthMode = mode === 'signin' || mode === 'signup' ? mode : 'signup';
  const [authMode, setAuthMode] = useState<AuthMode>(normalizedMode);
  const [selectedRole, setSelectedRole] = useState<OrganizationRole | null>(null);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [accreditationNumber, setAccreditationNumber] = useState('');
  const [organizationEmail, setOrganizationEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [confirmVerification, setConfirmVerification] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authHint, setAuthHint] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onboardingSubmitted, setOnboardingSubmitted] = useState(false);
  const [isHydratingSignup, setIsHydratingSignup] = useState(false);
  const [suspendedUser, setSuspendedUser] = useState<User | null>(null);

  const getRoleHomeRoute = useCallback((role: UserRole) => ROLE_HOME_ROUTES[role], []);

  const setAndPersistRole = useCallback((role: OrganizationRole | null) => {
    setSelectedRole(role);

    if (typeof window === 'undefined') {
      return;
    }

    if (role) {
      window.sessionStorage.setItem(SIGNUP_ROLE_STORAGE_KEY, role);
      return;
    }

    window.sessionStorage.removeItem(SIGNUP_ROLE_STORAGE_KEY);
  }, []);

  useEffect(() => {
    setAuthMode(normalizedMode);
    setAuthError(null);
    setAuthHint(null);
    setOnboardingSubmitted(false);
    setIsHydratingSignup(false);
    setSuspendedUser(null);
    setConfirmVerification(false);

    if (normalizedMode === 'signup' && typeof window !== 'undefined') {
      const persistedRole = window.sessionStorage.getItem(SIGNUP_ROLE_STORAGE_KEY);
      if (persistedRole === 'INSTITUTION') {
        setSelectedRole(persistedRole);
      } else {
        setSelectedRole(null);
      }
    }

    if (normalizedMode !== 'signup') {
      setSelectedRole(null);
    }
  }, [normalizedMode]);

  useEffect(() => {
    if (localSessionUser?.status === 'SUSPENDED') {
      setSuspendedUser(localSessionUser);
    }
  }, [localSessionUser]);

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
          navigate(getRoleHomeRoute(localUser.role), { replace: true });
          return;
        }

        if (localUser?.status === 'SUSPENDED') {
          setSuspendedUser(localUser);
          return;
        }

        if (localUser) {
          if (localUser.role === 'INSTITUTION') {
            setAndPersistRole(localUser.role);
            setFirstName(localUser.firstName || clerkUser.firstName || '');
            setMiddleName(localUser.middleName || '');
            setLastName(localUser.lastName || clerkUser.lastName || '');
            setRegistrationNumber(localUser.institution?.registrationNumber || '');
            setOrganizationName(localUser.institution?.institutionName || '');
            setAccreditationNumber(localUser.institution?.accreditationNumber || '');
            setOrganizationEmail(localUser.institution?.email || currentEmail);
            setPhoneNumber(localUser.institution?.phoneNumber || '');
            setAuthHint(null);
            return;
          }

          setAuthError('Self-signup is restricted to institution accounts.');
          return;
        }

        setFirstName(clerkUser.firstName ?? '');
        setMiddleName('');
        setLastName(clerkUser.lastName ?? '');
      } catch (error) {
        console.error('Failed to hydrate signup data:', error);
        if (!isCancelled) {
          showToast({
            variant: 'error',
            message: toErrorMessage(error, 'Unable to load your saved onboarding data right now.'),
          });
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
  }, [authMode, clerkUser, currentEmail, getRoleHomeRoute, isClerkLoaded, isSignedIn, navigate, refreshUser, setAndPersistRole, showToast]);

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

        if (localUser.status === 'SUSPENDED') {
          setSuspendedUser(localUser);
          return;
        }

        if (localUser.status === 'APPROVED') {
          navigate(getRoleHomeRoute(localUser.role), { replace: true });
          return;
        }

        showToast({
          variant: 'info',
          message: 'Account found, but it is not approved yet.',
        });
        navigate('/', { replace: true });
      } catch (error) {
        console.error('Failed to validate account after sign-in:', error);
        showToast({
          variant: 'error',
          message: toErrorMessage(error, 'Unable to validate your account right now. Please try again.'),
        });
      }
    };

    void syncAndRoute();
  }, [authMode, getRoleHomeRoute, isClerkLoaded, isSignedIn, navigate, refreshUser, showToast]);

  useEffect(() => {
    if (!organizationEmail && currentEmail) {
      setOrganizationEmail(currentEmail);
    }
  }, [currentEmail, organizationEmail]);

  const validateOrganizationOnboarding = () => {
    if (!selectedRole) {
      return 'Choose your account type to continue.';
    }

    if (!firstName.trim()) {
      return 'First name is required.';
    }

    if (!lastName.trim()) {
      return 'Last name is required.';
    }

    if (!organizationName.trim()) {
      return 'Institution name is required.';
    }

    if (!registrationNumber.trim()) {
      return 'Registration number is required.';
    }

    if (!organizationEmail.trim()) {
      return 'Organization email is required.';
    }

    if (!phoneNumber.trim()) {
      return 'Phone number is required.';
    }

    if (!/^\+63\d{10}$/.test(phoneNumber.trim())) {
      return 'Phone number must use +63 followed by 10 digits (e.g. +639123456789).';
    }

    if (selectedRole === 'INSTITUTION' && !accreditationNumber.trim()) {
      return 'Accreditation number is required for institution accounts.';
    }

    return null;
  };

  const handleFinalizeOnboarding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setAuthHint(null);

    const validationError = validateOrganizationOnboarding();
    if (validationError) {
      setAuthError(validationError);
      return;
    }

    if (!confirmVerification) {
      setAuthError('Confirm your details before submitting.');
      return;
    }

    if (!isSignedIn) {
      setAuthError('Authentication session expired. Please authenticate again.');
      return;
    }

    if (!selectedRole) {
      setAuthError('Choose your account type to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CompleteOrganizationOnboardingPayload = {
        role: 'INSTITUTION',
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
        lastName: lastName.trim(),
        institutionName: organizationName.trim(),
        accreditationNumber: accreditationNumber.trim(),
        registrationNumber: registrationNumber.trim(),
        organizationEmail: organizationEmail.trim(),
        phoneNumber: phoneNumber.trim(),
      };

      await UserService.completeOrganizationOnboarding(payload);
      await refreshUser();

      setOnboardingSubmitted(true);
      showToast({
        variant: 'success',
        message: 'Your account creation request is now pending admin approval.',
      });
    } catch (error) {
      console.error('Failed to submit onboarding:', error);
      showToast({
        variant: 'error',
        message: toErrorMessage(error, 'Unable to submit onboarding. Please review your inputs and try again.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStep = !selectedRole ? 1 : isSignedIn ? 3 : 2;
  const isRoleStep = !selectedRole;
  const isAuthStep = !!selectedRole && !isSignedIn;
  const isProfileStep = !!selectedRole && isSignedIn;
  const roleDisplay = 'Institution';
  const authPageBackgroundStyle = {
    backgroundImage: `url(${heroBg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };

  if (suspendedUser) {
    return (
      <div className="credence-font flex min-h-screen items-center justify-center px-4 py-8 text-neutral-900 antialiased sm:px-6" style={authPageBackgroundStyle}>
        <div className="w-full max-w-[640px] rounded-lg border border-rose-200 bg-white/95 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.1)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <Icon className="text-lg" name="gpp_bad" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900">Account Suspended</h2>
          </div>

          <p className="text-base leading-relaxed text-neutral-700">
            Your account has been suspended by an admin or institution reviewer. If you think this is a mistake, contact the institution admin.
          </p>
          <p className="mt-3 text-sm text-neutral-500">Account: {suspendedUser.email}</p>

          <div className="mt-6">
            <Link
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              to="/"
            >
              <Icon className="text-sm" name="arrow_back" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (authMode === 'signin') {
    return (
      <div className="credence-font min-h-screen px-4 py-6 text-neutral-900 antialiased sm:px-6" style={authPageBackgroundStyle}>
        <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-[1120px] items-center gap-7 py-2 md:grid-cols-[minmax(0,1fr)_500px] md:gap-10 md:py-6">
          <div className="flex w-full justify-center md:h-full md:items-center">
            <SignInBrand />
          </div>

          <div className="mx-auto w-full max-w-[500px]">
            {!isClerkLoaded && (
              <div className="mx-auto w-full max-w-[401px] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-[0_10px_25px_rgba(0,0,0,.20)]">
                <div className="border-b border-neutral-200 px-9 pb-5 pt-8">
                  <div className="skeleton-shimmer mx-auto mb-6 h-6 w-25 rounded-md"></div>
                  <div className="skeleton-shimmer mx-auto mb-2.5 h-5 w-40 rounded-md"></div>
                  <div className="skeleton-shimmer skeleton-delay-1 mx-auto h-3.5 w-64 rounded-md"></div>

                  <div className="mt-8 mb-0 space-y-4">
                    <div className="relative">
                      <div className="skeleton-shimmer skeleton-delay-2 h-8 rounded-lg border border-neutral-200"></div>
                      <div className="skeleton-shimmer skeleton-delay-3 absolute -right-2 -top-2 h-4 w-15 rounded-full border border-neutral-200"></div>
                    </div>

                    <div className="skeleton-shimmer skeleton-delay-2 h-8 -mt-2 rounded-lg border border-neutral-200"></div>

                    <div className="flex items-center gap-3 mb-7 mt-7">
                      <div className="skeleton-shimmer h-px flex-1"></div>
                      <div className="skeleton-shimmer skeleton-delay-1 h-3 w-3 rounded"></div>
                      <div className="skeleton-shimmer h-px flex-1"></div>
                    </div>

                    <div className="space-y-2">
                      <div className="skeleton-shimmer skeleton-delay-1 h-3.5 w-25 rounded"></div>
                      <div className="skeleton-shimmer skeleton-delay-2 h-8 rounded-lg border border-neutral-200"></div>
                    </div>

                    <div className="skeleton-shimmer-strong skeleton-delay-3 h-8 rounded-lg flex items-center justify-center space-x-2 mt-8 mb-3">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent"></div>
                      <span className="text-sm font-medium">Loading...</span>
                    </div>
                  </div>
                </div>

                <div className="border-b border-neutral-200 bg-neutral-50/70 px-7 py-4">
                  <div className="skeleton-shimmer mx-auto h-3.5 w-52 rounded"></div>
                </div>

                <div className="bg-[repeating-linear-gradient(135deg,rgba(15,23,42,0.015)_0,rgba(15,23,42,0.015)_8px,transparent_8px,transparent_16px)] px-7 py-4">
                  <div className="skeleton-shimmer mx-auto h-3.5 w-30 rounded mb-3"></div>
                  <div className="skeleton-shimmer mx-auto h-3.5 w-34 rounded"></div>
                </div>
              </div>
            )}

            {isClerkLoaded && (
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
                      appearance={signInClerkAppearance}
                    />
                  </div>
                </SignedOut>
                <SignedIn>
                  <div className="rounded-lg border border-neutral-200 bg-white p-5 text-sm text-neutral-700">
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent"></div>
                      <p className="font-medium">Authentication complete. Validating account access...</p>
                    </div>
                  </div>
                </SignedIn>
              </div>
            )}

            {authError && <p className="mt-4 text-sm text-rose-700">{authError}</p>}
            {authHint && <p className="mt-2 text-sm text-neutral-600">{authHint}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="credence-font min-h-screen px-4 py-8 text-neutral-900 antialiased sm:px-6" style={authPageBackgroundStyle}>
      <div className="mx-auto mb-8 flex w-full max-w-[960px] items-center justify-between">
        <Link className="flex items-center gap-3 text-neutral-900" to="/">
          <img alt="Credence logo" className="h-8 w-auto" src={logo2} />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            to="/"
          >
            <Icon className="text-sm" name="arrow_back" />
            Back to Home
          </Link>
        </div>
      </div>

      <div className="mx-auto mb-5 w-full max-w-[560px]">
        <div className="mx-auto flex w-full max-w-[460px] items-center gap-2 px-1 md:px-2">
          <div className="flex flex-col items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-full border text-xs font-semibold ${
                currentStep >= 1 ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-400'
              }`}
            >
              {currentStep > 1 ? <Icon className="text-sm" name="check" /> : 1}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${currentStep >= 1 ? 'text-neutral-900' : 'text-neutral-400'}`}>
              Role
            </span>
          </div>
          <div className={`h-px flex-1 ${currentStep >= 2 ? 'bg-neutral-400' : 'bg-neutral-200'}`}></div>
          <div className="flex flex-col items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-full border text-xs font-semibold ${
                currentStep >= 2 ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-400'
              }`}
            >
              {currentStep > 2 ? <Icon className="text-sm" name="check" /> : 2}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${currentStep >= 2 ? 'text-neutral-900' : 'text-neutral-400'}`}>
              Account
            </span>
          </div>
          <div className={`h-px flex-1 ${currentStep >= 3 ? 'bg-neutral-400' : 'bg-neutral-200'}`}></div>
          <div className="flex flex-col items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-full border text-xs font-semibold ${
                currentStep >= 3 ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-400'
              }`}
            >
              3
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${currentStep >= 3 ? 'text-neutral-900' : 'text-neutral-400'}`}>
              Details
            </span>
          </div>
        </div>
      </div>

      <div
        className={
          isAuthStep
            ? 'mx-auto w-full max-w-[520px]'
            : 'mx-auto w-full max-w-[760px] rounded-lg border border-neutral-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] md:p-8'
        }
      >
        {isAuthStep && !isClerkLoaded && (
          <div className="rounded-lg border border-neutral-200 bg-white p-5 text-sm text-neutral-700">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent"></div>
              <p className="font-medium">Loading authentication...</p>
            </div>
          </div>
        )}

        {isProfileStep && isHydratingSignup && (
          <div className="rounded-lg border border-neutral-200 bg-white p-5 text-sm text-neutral-700">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent"></div>
              <p className="font-medium">Loading your onboarding details...</p>
            </div>
          </div>
        )}

        {isRoleStep && (
          <div className="space-y-6">
            <div className="space-y-1 text-center">
              <h3 className="text-lg font-semibold tracking-tight text-neutral-900">Institution Registration</h3>
              <p className="text-sm text-neutral-500">Self-signup is available only for institution accounts.</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                type="button"
                onClick={() => setAndPersistRole('INSTITUTION')}
                className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 text-left transition hover:border-neutral-400 hover:bg-white"
              >
                <div className="mb-3 inline-flex rounded-full bg-neutral-900/5 p-2 text-neutral-700">
                  <Icon className="text-lg" name="apartment" />
                </div>
                <p className="text-base font-semibold text-neutral-900">Institution</p>
                <p className="mt-1 text-sm text-neutral-600">For schools and academic institutions issuing and validating records.</p>
              </button>
            </div>
          </div>
        )}

        {isAuthStep && isClerkLoaded && !isHydratingSignup && (
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
              <div className="rounded-lg border border-neutral-200 bg-white p-5 text-sm text-neutral-700">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent"></div>
                  <p className="font-medium">Authentication complete. Loading organization onboarding form...</p>
                </div>
              </div>
            </SignedIn>
          </div>
        )}

        {isProfileStep && !isHydratingSignup && (
          <form className="space-y-6" onSubmit={handleFinalizeOnboarding}>
            <div className="space-y-1 text-center">
              <h3 className="text-lg font-semibold tracking-tight text-neutral-900">Complete {roleDisplay} Profile</h3>
              <p className="text-sm text-neutral-500">Provide required details that match your organization record.</p>
              {currentEmail && <p className="text-xs text-neutral-500">Authenticated email: {currentEmail}</p>}
            </div>

            {onboardingSubmitted ? (
              <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
                <p className="text-base font-semibold">Account creation request submitted.</p>
                <p>
                  Your account is now <span className="font-semibold">PENDING</span> and must be approved by admin
                  before dashboard access is enabled.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-black"
                    to="/"
                  >
                    Back to Home
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-600">First Name</label>
                    <input
                      required
                      value={firstName}
                      onChange={event => setFirstName(event.target.value)}
                      placeholder="First Name"
                      className="h-12 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-600">Middle Name</label>
                    <input
                      value={middleName}
                      onChange={event => setMiddleName(event.target.value)}
                      placeholder="Middle Name (Optional)"
                      className="h-12 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-600">Last Name</label>
                    <input
                      required
                      value={lastName}
                      onChange={event => setLastName(event.target.value)}
                      placeholder="Last Name"
                      className="h-12 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-600">Institution Name</label>
                    <input
                      required
                      value={organizationName}
                      onChange={event => setOrganizationName(event.target.value)}
                      placeholder="Institution Name"
                      className="h-12 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-600">Registration Number</label>
                    <input
                      required
                      value={registrationNumber}
                      onChange={event => setRegistrationNumber(event.target.value)}
                      placeholder="Registration Number"
                      className="h-12 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-600">Accreditation Number</label>
                    <input
                      required
                      value={accreditationNumber}
                      onChange={event => setAccreditationNumber(event.target.value)}
                      placeholder="Accreditation Number"
                      className="h-12 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-600">Phone Number</label>
                    <input
                      required
                      value={phoneNumber}
                      onChange={event => setPhoneNumber(event.target.value)}
                      placeholder="Phone Number"
                      className="h-12 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-600">Institution Email</label>
                  <input
                    required
                    type="email"
                    value={organizationEmail}
                    onChange={event => setOrganizationEmail(event.target.value)}
                    placeholder="Institution Email"
                    className="h-12 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none"
                  />
                </div>

                <label className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={confirmVerification}
                    onChange={event => setConfirmVerification(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-neutral-300"
                  />
                  <span>I confirm these details are accurate and understand my account remains pending until admin approval.</span>
                </label>

                {authError && <p className="text-sm text-rose-700">{authError}</p>}
                {authHint && <p className="text-sm text-neutral-600">{authHint}</p>}
                <div className="flex flex-col items-center gap-3 border-t border-neutral-100 pt-4 sm:flex-row">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
                  >
                    {isSubmitting ? <ButtonLoadingContent label="Submitting" /> : 'Submit for Approval'}
                    <Icon className="text-base" name="send" />
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {authError && (isRoleStep || isAuthStep) && <p className="mt-4 text-sm text-rose-700">{authError}</p>}
      </div>
    </div>
  );
}
