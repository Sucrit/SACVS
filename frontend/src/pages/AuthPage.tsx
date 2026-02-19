import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLegacyAuth } from '../auth/legacy-auth-context';
import { UpsertStudentProfilePayload, UserService } from '../services/user.service';

type AuthMode = 'signin' | 'signup' | 'otp';
const SIGNUP_OTP_RESEND_SECONDS = 60;

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

function Logo({ className = 'w-8 h-8' }: { className?: string }) {
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

export default function AuthPage() {
  const navigate = useNavigate();
  const { mode } = useParams<{ mode: string }>();
  const { login, register, verifyOtp, refreshUser } = useLegacyAuth();

  const normalizedMode: AuthMode = mode === 'signin' || mode === 'signup' || mode === 'otp' ? mode : 'signup';
  const [authMode, setAuthMode] = useState<AuthMode>(normalizedMode);
  const [signupStep, setSignupStep] = useState<1 | 2>(1);

  const [authEmail, setAuthEmail] = useState('');
  const [authFirstName, setAuthFirstName] = useState('');
  const [authMiddleName, setAuthMiddleName] = useState('');
  const [authLastName, setAuthLastName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupOtp, setSignupOtp] = useState('');
  const [isSendingSignupOtp, setIsSendingSignupOtp] = useState(false);
  const [signupOtpCooldown, setSignupOtpCooldown] = useState(0);
  const [signupOtpRequestedEmail, setSignupOtpRequestedEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [pendingOtpEmail, setPendingOtpEmail] = useState('');
  const [profileForm, setProfileForm] = useState<UpsertStudentProfilePayload>(initialProfileForm);

  const [authError, setAuthError] = useState<string | null>(null);
  const [authHint, setAuthHint] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  useEffect(() => {
    setAuthMode(normalizedMode);
    setAuthError(null);
    setAuthHint(null);
    if (normalizedMode !== 'signup') {
      setSignupStep(1);
    }
  }, [normalizedMode]);

  useEffect(() => {
    if (signupOtpCooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setSignupOtpCooldown(prev => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [signupOtpCooldown]);

  const goMode = (nextMode: AuthMode) => {
    setAuthError(null);
    setAuthHint(null);
    setAuthMode(nextMode);
    navigate(`/auth/${nextMode}`, { replace: true });
  };

  const handleOauthClick = () => {
    setAuthError(null);
    setAuthHint('Google authentication is not available yet. Please continue with email.');
  };

  const handleForgotPasswordClick = () => {
    setAuthError(null);
    setAuthHint('Forgot password is not implemented yet. Please contact support for assistance.');
  };

  const handleSendSignupOtp = async () => {
    if (signupOtpCooldown > 0 || isSendingSignupOtp) {
      return;
    }

    setAuthError(null);
    setAuthHint(null);

    const email = authEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthError('Enter a valid email address before requesting OTP.');
      return;
    }

    if (signupPassword.trim().length < 8) {
      setAuthError('Password must be at least 8 characters before requesting OTP.');
      return;
    }

    setIsSendingSignupOtp(true);
    try {
      setSignupOtpRequestedEmail(email);
      setSignupOtpCooldown(SIGNUP_OTP_RESEND_SECONDS);
      setAuthHint('OTP sent. Please enter the code to continue.');
    } finally {
      setIsSendingSignupOtp(false);
    }
  };

  const handleSignupStepOneContinue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setAuthHint(null);

    const email = authEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthError('Enter a valid email address.');
      return;
    }

    if (signupPassword.trim().length < 8) {
      setAuthError('Password must be at least 8 characters.');
      return;
    }

    if (!signupOtpRequestedEmail || signupOtpRequestedEmail !== email) {
      setAuthError('Please send OTP first before continuing.');
      return;
    }

    if (!signupOtp.trim() || signupOtp.trim().length < 6) {
      setAuthError('Enter the OTP code for account verification.');
      return;
    }

    setAuthEmail(email);
    setSignupStep(2);
  };

  const handleCompleteSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setAuthHint(null);
    setIsSubmittingAuth(true);

    try {
      const email = authEmail.trim().toLowerCase();
      const firstName = authFirstName.trim();
      const middleName = authMiddleName.trim();
      const lastName = authLastName.trim();
      const otp = signupOtp.trim();

      if (!email || !firstName || !lastName || !otp) {
        setAuthError('Complete all required account fields.');
        return;
      }

      const profilePayload: UpsertStudentProfilePayload = {
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

      const hasMissingProfile =
        profilePayload.studentNumber.length === 0 ||
        profilePayload.street.length === 0 ||
        profilePayload.barangay.length === 0 ||
        profilePayload.city.length === 0 ||
        profilePayload.province.length === 0 ||
        !Number.isInteger(profilePayload.zipCode) ||
        profilePayload.zipCode <= 0 ||
        profilePayload.phone.length === 0 ||
        profilePayload.courseOfStudy.length === 0 ||
        profilePayload.yearLevel.length === 0 ||
        profilePayload.department.length === 0;

      if (hasMissingProfile) {
        setAuthError('Complete all student profile fields before requesting account creation.');
        return;
      }

      await register({
        email,
        firstName,
        middleName: middleName || undefined,
        lastName,
      });
      await verifyOtp({ email, otp });
      await UserService.upsertMyProfile(profilePayload);
      await refreshUser();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Failed to complete signup:', error);
      setAuthError('Unable to create account. Check your details and OTP.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleStartSignin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setAuthHint(null);
    setIsSubmittingAuth(true);

    try {
      const email = authEmail.trim().toLowerCase();
      if (!email) {
        setAuthError('Email is required.');
        return;
      }

      const response = await login({ email });
      setPendingOtpEmail(email);
      setAuthHint(response.otpBypassCode ? 'OTP challenge created.' : 'OTP sent to your email.');
      navigate('/auth/otp', { replace: true });
    } catch (error) {
      console.error('Failed to start sign in:', error);
      setAuthError('Unable to continue authentication. Please verify your email and try again.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleVerifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setIsSubmittingAuth(true);

    try {
      const email = pendingOtpEmail.trim().toLowerCase() || authEmail.trim().toLowerCase();
      if (!email) {
        setAuthError('Email is required before OTP verification.');
        return;
      }

      await verifyOtp({ email, otp: otpCode.trim() });
      await refreshUser();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('OTP verification failed:', error);
      setAuthError('Invalid OTP. Please try again.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const step = authMode === 'signup' ? signupStep : authMode === 'otp' ? 3 : 1;

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
                step >= 1 ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 bg-white text-slate-400'
              }`}
            >
              <Icon className="text-sm" name="check" />
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${step >= 1 ? 'text-blue-500' : 'text-slate-400'}`}>
              Account
            </span>
          </div>
          <div className={`h-px flex-1 ${step >= 2 ? 'bg-slate-300' : 'bg-slate-200'}`}></div>
          <div className="flex flex-col items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-full border text-xs font-semibold ${
                step >= 2 ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 bg-white text-slate-400'
              }`}
            >
              {step > 2 ? <Icon className="text-sm" name="check" /> : 2}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${step >= 2 ? 'text-blue-500' : 'text-slate-400'}`}>
              Profile
            </span>
          </div>
          <div className={`h-px flex-1 ${step >= 3 ? 'bg-slate-300' : 'bg-slate-200'}`}></div>
          <div className="flex flex-col items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-full border text-xs font-semibold ${
                step >= 3 ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 bg-white text-slate-400'
              }`}
            >
              3
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${step >= 3 ? 'text-blue-500' : 'text-slate-400'}`}>
              Verify
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[560px] rounded-3xl border border-slate-200 bg-[#f7f7f8] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.16)] md:p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-slate-900">
              {authMode === 'signup' ? 'Register Student Account' : authMode === 'signin' ? 'Sign In' : 'Verify OTP'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {authMode === 'signup' ? 'Start your verification request securely.' : 'Secure access to your account.'}
            </p>
          </div>
          <button
            onClick={() => (authMode === 'signup' ? goMode('signin') : goMode('signup'))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {authMode === 'signup' ? 'Already registered? Sign in' : 'Sign Up'}
          </button>
        </div>

        <div className="credence-auth-card rounded-3xl border border-white/80 bg-white p-5 md:p-6">
          {authMode === 'signup' && signupStep === 1 && (
            <form className="space-y-5" onSubmit={handleSignupStepOneContinue}>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleOauthClick}
                  className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                  </svg>
                  Continue with Google
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Or continue with email
                  </span>
                </div>
              </div>

              <input
                required
                type="email"
                value={authEmail}
                onChange={event => setAuthEmail(event.target.value)}
                placeholder="student@university.edu"
                className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
              />
              <div className="relative">
                <input
                  required
                  type={showSignupPassword ? 'text' : 'password'}
                  value={signupPassword}
                  onChange={event => setSignupPassword(event.target.value)}
                  placeholder="Create a secure password"
                  className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                >
                  <Icon className="text-[19px]" name={showSignupPassword ? 'visibility' : 'visibility_off'} />
                </button>
              </div>
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-slate-400">Must be at least 8 characters</p>
                <button
                  type="button"
                  onClick={handleForgotPasswordClick}
                  className="text-xs font-medium text-blue-600 transition hover:text-blue-700 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  required
                  value={signupOtp}
                  onChange={event => setSignupOtp(event.target.value)}
                  placeholder="Enter your OTP code"
                  className="credence-auth-input h-12 w-full flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleSendSignupOtp()}
                  disabled={isSendingSignupOtp || signupOtpCooldown > 0}
                  className="h-12 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSendingSignupOtp
                    ? 'Sending...'
                    : signupOtpCooldown > 0
                      ? `Resend OTP in ${signupOtpCooldown}s`
                      : signupOtpRequestedEmail
                        ? 'Resend OTP'
                        : 'Send OTP'}
                </button>
              </div>

              {authError && <p className="text-sm text-rose-700">{authError}</p>}
              {authHint && <p className="text-sm text-slate-600">{authHint}</p>}

              <button
                type="submit"
                className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-black"
              >
                Next
                <Icon className="text-sm transition-transform group-hover:translate-x-0.5" name="arrow_forward_ios" />
              </button>
              <p className="px-2 pt-2 text-center text-xs leading-relaxed text-slate-400">
                By continuing, you agree to Credence&apos;s{' '}
                <a className="font-medium text-slate-600 underline decoration-slate-300 hover:text-slate-800" href="#">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a className="font-medium text-slate-600 underline decoration-slate-300 hover:text-slate-800" href="#">
                  Privacy Policy
                </a>
                .
              </p>
            </form>
          )}

          {authMode === 'signup' && signupStep === 2 && (
            <form className="space-y-6" onSubmit={handleCompleteSignup}>
              <div className="space-y-1 text-center">
                <h4 className="text-2xl font-bold tracking-tight text-slate-900">Complete Your Student Profile</h4>
                <p className="text-sm text-slate-500">
                  Please provide your official university details to initiate verification.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600">
                    First Name
                  </label>
                  <input
                    required
                    value={authFirstName}
                    onChange={event => setAuthFirstName(event.target.value)}
                    placeholder="First Name"
                    className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600">
                    Middle Name
                  </label>
                  <input
                    value={authMiddleName}
                    onChange={event => setAuthMiddleName(event.target.value)}
                    placeholder="Middle Name (Optional)"
                    className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600">
                    Last Name
                  </label>
                  <input
                    required
                    value={authLastName}
                    onChange={event => setAuthLastName(event.target.value)}
                    placeholder="Last Name"
                    className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <Icon className="text-lg text-slate-900" name="id_card" />
                  Student Number
                </label>
                <input
                  required
                  value={profileForm.studentNumber}
                  onChange={event => setProfileForm(prev => ({ ...prev, studentNumber: event.target.value }))}
                  placeholder="e.g. 03-2226-123456"
                  className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                />
                <p className="text-xs text-slate-400">This should match your university-issued student number.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <Icon className="text-lg text-slate-900" name="call" />
                    Phone Number
                  </label>
                  <input
                    required
                    value={profileForm.phone}
                    onChange={event => setProfileForm(prev => ({ ...prev, phone: event.target.value }))}
                    placeholder="+63 912 345 6789"
                    className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <Icon className="text-lg text-slate-900" name="apartment" />
                    Department
                  </label>
                  <select
                    required
                    value={profileForm.department}
                    onChange={event => setProfileForm(prev => ({ ...prev, department: event.target.value }))}
                    className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
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
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <Icon className="text-lg text-slate-900" name="school" />
                    Course of Study
                  </label>
                  <select
                    required
                    value={profileForm.courseOfStudy}
                    onChange={event => setProfileForm(prev => ({ ...prev, courseOfStudy: event.target.value }))}
                    className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
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
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <Icon className="text-lg text-slate-900" name="calendar_month" />
                    Year Level
                  </label>
                  <select
                    required
                    value={profileForm.yearLevel}
                    onChange={event => setProfileForm(prev => ({ ...prev, yearLevel: event.target.value }))}
                    className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                  >
                    <option value="">Select Year Level</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                    <option value="5th Year">5th Year</option>
                    <option value="Postgraduate">Postgraduate</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <Icon className="text-lg text-slate-900" name="home" />
                    Street
                  </label>
                  <input
                    required
                    value={profileForm.street}
                    onChange={event => setProfileForm(prev => ({ ...prev, street: event.target.value }))}
                    placeholder="Street"
                    className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <Icon className="text-lg text-slate-900" name="location_city" />
                    Barangay
                  </label>
                  <input
                    required
                    value={profileForm.barangay}
                    onChange={event => setProfileForm(prev => ({ ...prev, barangay: event.target.value }))}
                    placeholder="Barangay"
                    className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <Icon className="text-lg text-slate-900" name="location_city" />
                    City
                  </label>
                  <input
                    required
                    value={profileForm.city}
                    onChange={event => setProfileForm(prev => ({ ...prev, city: event.target.value }))}
                    placeholder="City"
                    className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <Icon className="text-lg text-slate-900" name="map" />
                    Province
                  </label>
                  <input
                    required
                    value={profileForm.province}
                    onChange={event => setProfileForm(prev => ({ ...prev, province: event.target.value }))}
                    placeholder="Province"
                    className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <Icon className="text-lg text-slate-900" name="pin_drop" />
                  Zip Code
                </label>
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
                  className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                />
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
                <Icon className="mt-0.5 text-slate-900" name="info" />
                <p className="text-sm leading-relaxed text-slate-600">
                  <span className="font-semibold text-blue-600">Note:</span> Your account will remain{' '}
                  <span className="font-semibold text-slate-800">Pending</span> until reviewed by admin and registrar.
                </p>
              </div>

              {authError && <p className="text-sm text-rose-700">{authError}</p>}
              {authHint && <p className="text-sm text-slate-600">{authHint}</p>}

              <div className="flex flex-col items-center gap-3 border-t border-slate-100 pt-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setAuthHint(null);
                    setSignupStep(1);
                  }}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 sm:w-auto"
                >
                  <Icon className="text-base" name="arrow_back" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
                >
                  {isSubmittingAuth ? 'Submitting...' : 'Submit for Verification'}
                  <Icon className="text-base" name="send" />
                </button>
              </div>
            </form>
          )}

          {authMode === 'signin' && (
            <form className="space-y-5" onSubmit={handleStartSignin}>
              <input
                required
                type="email"
                value={authEmail}
                onChange={event => setAuthEmail(event.target.value)}
                placeholder="student@university.edu"
                className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
              />

              {authError && <p className="text-sm text-rose-700">{authError}</p>}
              {authHint && <p className="text-sm text-slate-600">{authHint}</p>}

              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {isSubmittingAuth ? 'Sending OTP...' : 'Continue'}
              </button>
            </form>
          )}

          {authMode === 'otp' && (
            <form className="space-y-5" onSubmit={handleVerifyOtp}>
              <input
                required
                type="email"
                value={pendingOtpEmail || authEmail}
                onChange={event => setPendingOtpEmail(event.target.value)}
                placeholder="student@university.edu"
                className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
              />
              <input
                required
                value={otpCode}
                onChange={event => setOtpCode(event.target.value)}
                placeholder="Enter OTP code"
                className="credence-auth-input h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
              />

              {authError && <p className="text-sm text-rose-700">{authError}</p>}
              {authHint && <p className="text-sm text-slate-600">{authHint}</p>}

              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {isSubmittingAuth ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button
                type="button"
                onClick={() => goMode('signin')}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
