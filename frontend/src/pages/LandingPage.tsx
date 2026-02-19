import { Bot, Globe2, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLegacyAuth } from '../auth/legacy-auth-context';
import studentsGraduateImage from '../assets/students-graduates.jpg';
import { UpsertStudentProfilePayload, UserService, UserStatus } from '../services/user.service';

const platformLinks = ['How it works', 'Blockchain', 'AI Security', 'Verification'];
const audienceLinks = ['For Universities', 'For Students', 'For Registrar'];
const companyLinks = ['About Us', 'Privacy Policy', 'Terms of Service', 'Contact Support'];

const features: Array<{
  icon: LucideIcon;
  title: string;
  description: string;
}> = [
  {
    icon: ShieldCheck,
    title: 'Tamper-Proof Records',
    description:
      'Our decentralized ledger technology ensures academic records can never be altered, forged, or deleted once issued.',
  },
  {
    icon: Bot,
    title: 'AI-Driven Verification',
    description:
      'Advanced neural networks automatically scan and validate credentials, providing instant results with 99.9% accuracy.',
  },
  {
    icon: Globe2,
    title: 'Global Portability',
    description:
      'Share your achievements across borders instantly. Compatible with major job boards and immigration systems worldwide.',
  },
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

const getStatusMessage = (status: UserStatus) => {
  if (status === 'REJECTED') {
    return {
      title: 'Account request was rejected',
      description: 'Your account request was reviewed and rejected. Please contact admin or registrar.',
      tone: 'text-rose-700 bg-rose-50 border-rose-200',
    };
  }

  if (status === 'SUSPENDED') {
    return {
      title: 'Account is suspended',
      description: 'Your student account is suspended. Please contact admin for reactivation.',
      tone: 'text-amber-700 bg-amber-50 border-amber-200',
    };
  }

  return {
    title: 'Account request is pending',
    description:
      'Your profile has been submitted. You can access the student dashboard after admin and registrar approval.',
    tone: 'text-slate-700 bg-slate-100 border-slate-300',
  };
};

export default function LandingPage() {
  const { user, isAuthenticated, isLoading, refreshUser, logout } = useLegacyAuth();
  const [profileForm, setProfileForm] = useState<UpsertStudentProfilePayload>(initialProfileForm);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);

  const isStudent = user?.role === 'STUDENT';
  const gateState: 'idle' | 'loading' | 'profile' | 'status' | 'approved' =
    !isAuthenticated ? 'idle' : isLoading ? 'loading' : !isStudent ? 'approved' : !user?.profile ? 'profile' : user.status !== 'APPROVED' ? 'status' : 'approved';

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError(null);
    setIsSubmittingProfile(true);

    const payload: UpsertStudentProfilePayload = {
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

    if (!Number.isInteger(payload.zipCode) || payload.zipCode <= 0) {
      setProfileError('Zip code must be a valid number.');
      setIsSubmittingProfile(false);
      return;
    }

    try {
      await UserService.upsertMyProfile(payload);
      setProfileForm(payload);
      await refreshUser();
    } catch (error) {
      console.error('Failed to submit student profile:', error);
      setProfileError('Unable to submit profile. Please verify your information and try again.');
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const shouldShowStudentGate = isAuthenticated && ['loading', 'profile', 'status'].includes(gateState);

  return (
    <div className="credence-font credence-page-bg relative flex min-h-screen w-full flex-col overflow-x-hidden text-slate-900 antialiased">
      <header className="fixed inset-x-0 top-0 z-50 w-full border-b border-slate-100 bg-white/80 px-6 py-4 backdrop-blur-xl md:px-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-slate-900">
              <Logo />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">credence</h2>
          </div>

          <div className="flex items-center gap-3">
            {!isAuthenticated && (
              <>
                <Link
                  to="/auth/signin"
                  className="hidden h-10 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 sm:flex"
                >
                  Sign In
                </Link>
                <Link
                  to="/auth/signup"
                  className="flex h-10 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white shadow-md shadow-black/20 transition-all hover:brightness-105"
                >
                  Get Started
                </Link>
              </>
            )}
            {isAuthenticated && (
              <>
                {gateState === 'approved' ? (
                  <Link
                    className="flex h-10 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
                    to="/dashboard"
                  >
                    Dashboard
                  </Link>
                ) : (
                  <span className="hidden rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 sm:inline-flex">
                    Verification Required
                  </span>
                )}
                <button
                  onClick={logout}
                  className="flex h-10 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white shadow-md shadow-black/20 transition-all hover:brightness-105"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="credence-hero-gradient relative overflow-hidden pb-32 pt-40">
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div className="credence-bg-mesh absolute inset-0"></div>
          </div>
          <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-6 text-center md:px-20">
            <h1 className="mb-6 max-w-4xl text-5xl font-extrabold leading-[1.1] tracking-tight text-slate-900 md:text-7xl">
              Securing Academic Excellence with <span className="text-slate-500">Blockchain</span> and{' '}
              <span className="text-slate-500">AI</span>
            </h1>
            <p className="mb-10 max-w-2xl text-lg leading-relaxed text-slate-500 md:text-xl">
              The standard for immutable, instantly verifiable academic credentials. Own your achievement,
              empower your institution with decentralized trust.
            </p>
          </div>

        </section>

        <section className="relative overflow-hidden py-24">
          <div aria-hidden className="absolute inset-0">
            <div className="credence-academic-bg absolute inset-0"></div>
            <div className="absolute inset-0 bg-white/90"></div>
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-20">
            <div className="mb-16">
              <h2 className="mb-4 text-3xl font-black md:text-4xl">The Future of Academic Integrity</h2>
              <p className="mb-8 text-lg leading-relaxed text-slate-500">
                Leveraging cutting-edge technology to create a seamless, fraud-free ecosystem for academic
                credentials.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {features.map(feature => {
                const FeatureIcon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className="credence-glass-card group rounded-3xl border border-slate-100 p-8 transition-all hover:border-slate-300"
                  >
                    <div className="mb-6 inline-flex">
                      <div className="relative flex size-14 items-center justify-center rounded-2xl border border-slate-300 bg-white/90 shadow-[0_10px_25px_-14px_rgba(15,23,42,0.35)] transition-transform group-hover:scale-110">
                        <div className="absolute inset-[1px] rounded-2xl bg-gradient-to-br from-slate-300/40 via-slate-200/30 to-transparent"></div>
                        <FeatureIcon className="relative h-7 w-7 text-slate-900" strokeWidth={2.2} />
                      </div>
                    </div>
                    <h3 className="mb-3 text-xl font-bold">{feature.title}</h3>
                    <p className="leading-relaxed text-slate-500">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="mx-auto flex max-w-7xl flex-col gap-32 px-6 md:px-20">
            <div className="flex flex-col items-center gap-16 md:flex-row">
              <div className="order-2 w-full md:order-1 md:w-1/2">
                <div className="relative overflow-hidden rounded-3xl">
                  <img
                    alt="Group of happy graduates holding digital tablets"
                    className="relative aspect-video w-full object-cover object-[50%_22%]"
                    src={studentsGraduateImage}
                  />
                </div>
              </div>
              <div className="order-1 w-full md:order-2 md:w-1/2">
                <div className="mb-6 inline-flex items-center rounded-full bg-black/10 px-3 py-1 text-xs font-bold uppercase text-slate-900">
                  For Students
                </div>
                <h2 className="mb-6 text-4xl font-black">Own Your Achievement</h2>
                <p className="mb-8 text-lg leading-relaxed text-slate-500">
                  No more waiting weeks for paper transcripts. Store your degrees, certifications, and skills in a
                  secure digital vault that you control. Share with employers in one click.
                </p>
                <ul className="mb-10 space-y-4">
                  <li className="flex items-start gap-3">
                    <Icon className="text-slate-900" name="check_circle" />
                    <span>Faster and safer sharing of credentials</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Icon className="text-slate-900" name="check_circle" />
                    <span>Secure and tamper-proof digital certificates</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Icon className="text-slate-900" name="check_circle" />
                    <span>Blockchain-backed proof of authenticity</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col items-center gap-16 md:flex-row">
              <div className="w-full md:w-1/2">
                <div className="mb-6 inline-flex items-center rounded-full bg-black/10 px-3 py-1 text-xs font-bold uppercase text-slate-900">
                  For University
                </div>
                <h2 className="mb-6 text-4xl font-black">Modernize Your Workflow</h2>
                <p className="mb-8 text-lg leading-relaxed text-slate-500">
                  Eliminate administrative overhead and manual verification requests. Issue tamper-proof digital
                  certificates in bulk and protect your institution&apos;s reputation.
                </p>
                <ul className="mb-10 space-y-4">
                  <li className="flex items-start gap-3">
                    <Icon className="text-slate-900" name="check_circle" />
                    <span>Instant issuance in seconds</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Icon className="text-slate-900" name="check_circle" />
                    <span>Efficient credential management</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Icon className="text-slate-900" name="check_circle" />
                    <span>Comprehensive analytics dashboard</span>
                  </li>
                </ul>
              </div>
              <div className="w-full md:w-1/2">
                <div className="relative">
                  <img
                    alt="Modern university campus building with glass architecture"
                    className="relative aspect-video rounded-3xl border border-slate-100 object-cover shadow-xl"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCNVUgPGIQ0caDCAW9maqGPHMUeOBWjSUH2m3q1whcJU_ad4juI3QauIHYNhfmyoMad-RM_3WCHJHWy1gEphuhusPlySi6ktAOgQkgR14dDoqRqk8eFEv2_yw7eGYDa2_sJoc_i_DpFynBt70ebv9wulR4h_CPI3bJEK8My5v3z12QoH97Q95KpGkxlGiYWAYQzRAGbu06hw_ueDuS-NDQUHS4eJkwocbBjFNHKjp70R0fkW3Pryqq84ZJ1Y9HSuyPUe-obaov0bJzl"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer className="border-t border-slate-100 bg-slate-50 px-6 pb-10 pt-20 md:px-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 grid grid-cols-2 gap-12 md:grid-cols-4 lg:grid-cols-5">
            <div className="col-span-2 lg:col-span-2">
              <div className="mb-6 flex items-center gap-3">
                <div className="text-slate-900">
                  <Logo className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-extrabold tracking-tight">credence</h2>
              </div>
              <p className="mb-6 max-w-sm text-slate-500">
                Decentralizing credential verification to eliminate fraud and empower lifetime learning achievements.
              </p>
              <div className="flex gap-4">
                <a
                  className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900"
                  href="#"
                >
                  <Icon name="share" />
                </a>
                <a
                  className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900"
                  href="#"
                >
                  <Icon name="language" />
                </a>
              </div>
            </div>

            <div>
              <h4 className="mb-6 font-bold">Platform</h4>
              <ul className="space-y-4 text-sm text-slate-500">
                {platformLinks.map(link => (
                  <li key={link}>
                    <a className="transition-colors hover:text-slate-900" href="#">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-6 font-bold">Audience</h4>
              <ul className="space-y-4 text-sm text-slate-500">
                {audienceLinks.map(link => (
                  <li key={link}>
                    <a className="transition-colors hover:text-slate-900" href="#">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-6 font-bold">Company</h4>
              <ul className="space-y-4 text-sm text-slate-500">
                {companyLinks.map(link => (
                  <li key={link}>
                    <a className="transition-colors hover:text-slate-900" href="#">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-6 border-t border-slate-200 pt-10 md:flex-row">
            <p className="text-sm text-slate-500">&copy; 2026 Credence. All academic rights reserved.</p>
            <div className="flex gap-8 text-xs font-bold uppercase tracking-widest text-slate-500">
              <a className="hover:text-slate-900" href="#">
                Whitepaper
              </a>
              <a className="hover:text-slate-900" href="#">
                Security Audit
              </a>
              <a className="hover:text-slate-900" href="#">
                API Docs
              </a>
            </div>
          </div>
        </div>
      </footer>

      {shouldShowStudentGate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/38 p-6">
          <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl md:p-8">
            {gateState === 'loading' && (
              <div className="flex items-center gap-3 text-slate-700">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent"></div>
                <p className="text-sm font-medium">Preparing your account verification flow...</p>
              </div>
            )}

            {gateState === 'profile' && (
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Student Verification Required</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Complete your Student Profile details before your account creation request can be reviewed.
                </p>

                <form className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleProfileSubmit}>
                  <input
                    required
                    value={profileForm.studentNumber}
                    onChange={event => setProfileForm(prev => ({ ...prev, studentNumber: event.target.value }))}
                    placeholder="Student Number"
                    className="rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  />
                  <input
                    required
                    value={profileForm.phone}
                    onChange={event => setProfileForm(prev => ({ ...prev, phone: event.target.value }))}
                    placeholder="Phone"
                    className="rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  />
                  <input
                    required
                    value={profileForm.courseOfStudy}
                    onChange={event => setProfileForm(prev => ({ ...prev, courseOfStudy: event.target.value }))}
                    placeholder="Course of Study"
                    className="rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  />
                  <input
                    required
                    value={profileForm.yearLevel}
                    onChange={event => setProfileForm(prev => ({ ...prev, yearLevel: event.target.value }))}
                    placeholder="Year Level"
                    className="rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  />
                  <input
                    required
                    value={profileForm.department}
                    onChange={event => setProfileForm(prev => ({ ...prev, department: event.target.value }))}
                    placeholder="Department"
                    className="rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  />
                  <input
                    required
                    value={profileForm.street}
                    onChange={event => setProfileForm(prev => ({ ...prev, street: event.target.value }))}
                    placeholder="Street"
                    className="rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  />
                  <input
                    required
                    value={profileForm.barangay}
                    onChange={event => setProfileForm(prev => ({ ...prev, barangay: event.target.value }))}
                    placeholder="Barangay"
                    className="rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  />
                  <input
                    required
                    value={profileForm.city}
                    onChange={event => setProfileForm(prev => ({ ...prev, city: event.target.value }))}
                    placeholder="City"
                    className="rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  />
                  <input
                    required
                    value={profileForm.province}
                    onChange={event => setProfileForm(prev => ({ ...prev, province: event.target.value }))}
                    placeholder="Province"
                    className="rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  />
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
                    className="rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  />

                  {profileError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 md:col-span-2">
                      {profileError}
                    </div>
                  )}

                  <div className="flex justify-end md:col-span-2">
                    <button
                      type="submit"
                      disabled={isSubmittingProfile}
                      className="inline-flex items-center rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmittingProfile ? 'Submitting...' : 'Submit Account Creation Request'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {gateState === 'status' && user && (
              <div>
                {(() => {
                  const statusMeta = getStatusMessage(user.status);
                  return (
                    <>
                      <h2 className="text-2xl font-bold text-slate-900">{statusMeta.title}</h2>
                      <p className="mt-2 text-sm text-slate-600">{statusMeta.description}</p>
                      <div className={`mt-5 rounded-xl border px-4 py-3 text-sm font-medium ${statusMeta.tone}`}>
                        Current account status: {user.status}
                      </div>
                    </>
                  );
                })()}
                <button
                  onClick={() => void refreshUser()}
                  className="mt-6 inline-flex items-center rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:brightness-105"
                >
                  Refresh Status
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
