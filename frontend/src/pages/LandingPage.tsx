import { Bot, Globe2, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLegacyAuth } from '../auth/auth-context';
import { UserRole } from '../services/user.service';
import studentsGraduateImage from '../assets/students-graduates.jpg';
import logo2 from '../assets/logo2.png';

const platformLinks = ['How it works', 'Blockchain', 'AI Security', 'Verification'];
const audienceLinks = ['For Institutions', 'For Students', 'For Employers'];
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

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, isSessionAuthenticated, logout } = useLegacyAuth();
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyInputError, setVerifyInputError] = useState<string | null>(null);
  const roleRoutes: Record<UserRole, string> = {
    STUDENT: '/student',
    ADMIN: '/admin',
    EMPLOYER: '/employer',
    INSTITUTION: '/institution',
  };

  const isApprovedSession = isSessionAuthenticated && !!user && user.status === 'APPROVED';
  const shouldContinueOnboarding = isSessionAuthenticated && !isApprovedSession;

  const extractTokenFromInput = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';

    try {
      const parsed = new URL(trimmed);
      const parts = parsed.pathname.split('/').filter(Boolean);
      const token = parts[parts.length - 1] || '';
      return decodeURIComponent(token);
    } catch {
      return decodeURIComponent(trimmed);
    }
  };

  const handlePublicVerify = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = extractTokenFromInput(verifyInput);
    if (!token) {
      setVerifyInputError('Enter a QR verification URL or token.');
      return;
    }
    setVerifyInputError(null);
    navigate(`/verify/qr/${encodeURIComponent(token)}`);
  };

  return (
    <div className="credence-font credence-page-bg relative flex min-h-screen w-full flex-col overflow-x-hidden text-slate-900 antialiased">
      <header className="fixed inset-x-0 top-0 z-50 w-full px-4 py-4 md:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-slate-200/60 bg-white/60 px-5 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)] backdrop-blur-xl md:px-7">
          <img alt="Credence logo" className="h-7 w-auto" src={logo2} />

          <nav className="hidden items-center gap-10 md:flex">
            <a className="text-sm font-medium text-slate-600 transition hover:text-slate-900" href="#features">
              Features
            </a>
            <a className="text-sm font-medium text-slate-600 transition hover:text-slate-900" href="#public-verify">
              Public Verify
            </a>
            <a className="text-sm font-medium text-slate-600 transition hover:text-slate-900" href="#solutions">
              Solutions
            </a>
            <a className="text-sm font-medium text-slate-600 transition hover:text-slate-900" href="#team">
              Team  
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {!isSessionAuthenticated && (
              <>
                <Link
                  to="/auth/signin"
                  className="hidden h-9 items-center justify-center rounded-full px-4 text-sm font-medium text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 sm:flex"
                >
                  Sign In
                </Link>
                <Link
                  to="/auth/signup"
                  className="flex h-9 items-center justify-center rounded-full bg-black px-5 text-sm font-semibold text-white shadow-md shadow-black/20 transition-all hover:brightness-105"
                >
                  Get Started
                </Link>
              </>
            )}

            {isSessionAuthenticated && (
              <>
                {isApprovedSession ? (
                  <Link
                    className="flex h-9 items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100"
                    to={roleRoutes[user.role]}
                  >
                    Dashboard
                  </Link>
                ) : (
                  <Link
                    className="flex h-9 items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100"
                    to={shouldContinueOnboarding ? '/auth/signup' : '/auth/signin'}
                  >
                    Continue Onboarding
                  </Link>
                )}

                <button
                  onClick={() => void logout()}
                  className="flex h-9 items-center justify-center rounded-full bg-black px-5 text-sm font-semibold text-white shadow-md shadow-black/20 transition-all hover:brightness-105"
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
            <form
              id="public-verify"
              onSubmit={handlePublicVerify}
              className="w-full max-w-3xl rounded-2xl border border-slate-200/70 bg-white/70 p-3 shadow-[0_8px_25px_rgba(15,23,42,0.08)] backdrop-blur"
            >
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  type="text"
                  value={verifyInput}
                  onChange={event => setVerifyInput(event.target.value)}
                  placeholder="Paste one-time verification QR URL or token"
                  className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-300"
                />
                <button
                  type="submit"
                  className="h-11 rounded-xl bg-black px-5 text-sm font-semibold text-white shadow-md shadow-black/20 transition-all hover:brightness-105"
                >
                  Verify Credential
                </button>
              </div>
              {verifyInputError && <p className="mt-2 text-left text-xs font-semibold text-rose-700">{verifyInputError}</p>}
            </form>
          </div>
        </section>

        <section id="features" className="relative overflow-hidden py-24">
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

        <section id="solutions" className="py-24">
          <div className="mx-auto max-w-7xl px-6 md:px-20">
            <div className="space-y-8">
              <article className="overflow-hidden rounded-[2rem] border border-[#2b3e52] bg-[#1b2a3a] shadow-[0_18px_44px_rgba(15,23,42,0.28)]">
                <div className="grid grid-cols-1 md:grid-cols-2">
                  <div className="relative order-2 min-h-[280px] md:order-1 md:min-h-full">
                    <img
                      alt="Graduates celebrating their accomplishments"
                      className="absolute inset-0 h-full w-full object-cover object-[50%_25%]"
                      src={studentsGraduateImage}
                    />
                    <div
                      className="absolute inset-y-0 right-0 w-28"
                      style={{
                        background:
                          'linear-gradient(to left, #1b2a3a 0%, rgba(27,42,58,0.9) 20%, rgba(27,42,58,0.65) 40%, rgba(27,42,58,0.35) 62%, rgba(27,42,58,0.14) 80%, rgba(27,42,58,0) 100%)',
                      }}
                    ></div>
                  </div>
                  <div className="relative z-10 order-1 p-8 md:order-2 md:p-12 lg:p-14">
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-300">For Students</p>
                    <h3 className="mt-4 text-4xl font-black leading-tight text-white">
                      Your achievements.
                      <br />
                      In your pocket.
                    </h3>
                    <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-300">
                      Access your credentials from anywhere and share instantly with schools, employers, and licensing
                      offices with trusted verifiable proof.
                    </p>
                    <a className="mt-8 inline-flex items-center gap-1 text-sm font-bold text-white hover:text-slate-200" href="#">
                      View student access
                      <Icon className="text-base" name="chevron_right" />
                    </a>
                  </div>
                </div>
              </article>
              <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[#eaf1f7] shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                <div className="grid grid-cols-1 md:grid-cols-2">
                  <div className="relative z-10 p-8 md:p-12 lg:p-14">
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-700">For Institutions</p>
                    <h3 className="mt-4 text-4xl font-black leading-tight text-slate-900">
                      Secure issuance.
                      <br />
                      At massive scale.
                    </h3>
                    <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-600">
                      Protect your institution with a streamlined dashboard built for bulk credential issuance,
                      verification, and lifecycle management.
                    </p>
                    <a className="mt-8 inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:text-blue-800" href="#">
                      Learn more
                      <Icon className="text-base" name="chevron_right" />
                    </a>
                  </div>
                  <div className="relative min-h-[280px] md:min-h-full">
                    <img
                      alt="Modern university campus building with glass architecture"
                      className="absolute inset-0 h-full w-full object-cover"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCNVUgPGIQ0caDCAW9maqGPHMUeOBWjSUH2m3q1whcJU_ad4juI3QauIHYNhfmyoMad-RM_3WCHJHWy1gEphuhusPlySi6ktAOgQkgR14dDoqRqk8eFEv2_yw7eGYDa2_sJoc_i_DpFynBt70ebv9wulR4h_CPI3bJEK8My5v3z12QoH97Q95KpGkxlGiYWAYQzRAGbu06hw_ueDuS-NDQUHS4eJkwocbBjFNHKjp70R0fkW3Pryqq84ZJ1Y9HSuyPUe-obaov0bJzl"
                    />
                    <div
                      className="absolute inset-y-0 left-0 w-28"
                      style={{
                        background:
                          'linear-gradient(to right, #eaf1f7 0%, rgba(234,241,247,0.92) 22%, rgba(234,241,247,0.66) 44%, rgba(234,241,247,0.36) 64%, rgba(234,241,247,0.14) 82%, rgba(234,241,247,0) 100%)',
                      }}
                    ></div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>
      </main>

      <footer id="team" className="border-t border-slate-100 bg-slate-50 px-6 pb-10 pt-20 md:px-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 grid grid-cols-2 gap-12 md:grid-cols-4 lg:grid-cols-5">
            <div className="col-span-2 lg:col-span-2">
              <img alt="Credence logo" className="mb-6 h-7 w-auto" src={logo2} />
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
                Security Audit
              </a>
              <a className="hover:text-slate-900" href="#">
                API Docs
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
