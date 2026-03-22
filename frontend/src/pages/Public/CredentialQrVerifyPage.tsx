import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileBadge2,
  FileSearch,
  GraduationCap,
  Hash,
  LockKeyhole,
  School,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { CredentialService, QrVerificationResult } from '../../services/credential.service';
import ButtonLoadingContent from '../../components/common/ButtonLoadingContent';
import Badge from '../../components/common/Badge';

const parseTokenInput = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const token = pathParts[pathParts.length - 1] || '';
    return decodeURIComponent(token);
  } catch {
    return decodeURIComponent(trimmed);
  }
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const maskToken = (value: string): string => {
  if (!value) return '-';
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-8)}`;
};

type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

interface SummaryConfig {
  tone: StatusTone;
  title: string;
  body: string;
  note: string;
  icon: typeof CheckCircle2;
}

interface DetailItemProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  emphasize?: boolean;
}

function DetailItem({ icon, label, value, emphasize = false }: DetailItemProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-slate-200/80 py-3 last:border-b-0 last:pb-0 first:pt-0">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          {icon}
        </span>
        {label}
      </div>
      <div className={twMerge('text-right text-sm font-semibold text-slate-900', emphasize && 'text-base')}>
        {value}
      </div>
    </div>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={twMerge(
        'rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6',
        className,
      )}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

const getSummaryConfig = (result: QrVerificationResult | null, error: string | null): SummaryConfig => {
  if (error) {
    return {
      tone: 'danger',
      title: 'Verification unavailable',
      body: error,
      note: 'The public proof could not be completed from this request. Check the QR source and try again.',
      icon: AlertCircle,
    };
  }

  if (!result) {
    return {
      tone: 'neutral',
      title: 'Preparing verification',
      body: 'The token is being checked against the public verification workflow.',
      note: 'Please wait while the one-time proof is validated.',
      icon: ShieldCheck,
    };
  }

  if (result.valid) {
    return {
      tone: 'success',
      title: 'Verified credential proof',
      body: 'This one-time proof was accepted and confirms the credential details shown below.',
      note: 'This verification confirms the public proof only. Shared documents remain separately token-protected.',
      icon: BadgeCheck,
    };
  }

  if (result.reason === 'EXPIRED') {
    return {
      tone: 'warning',
      title: 'Verification token expired',
      body: 'This public proof link is no longer active and cannot be used to confirm the credential.',
      note: 'Ask the credential holder to generate a new public verification token.',
      icon: Clock3,
    };
  }

  if (result.reason === 'USED') {
    return {
      tone: 'neutral',
      title: 'Token already used',
      body: 'This one-time proof has already been consumed and cannot be used again.',
      note: 'Ask the credential holder to share a fresh public verification token.',
      icon: ShieldAlert,
    };
  }

  return {
    tone: 'danger',
    title: 'Invalid verification token',
    body: 'This QR token could not be matched to an active public credential proof.',
    note: 'Confirm that the full verification link was opened and request a new token if needed.',
    icon: XCircle,
  };
};

const SUMMARY_STYLES: Record<StatusTone, string> = {
  success: 'border-emerald-200/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(209,250,229,0.88))] text-emerald-950',
  warning: 'border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(254,243,199,0.92))] text-amber-950',
  danger: 'border-rose-200/80 bg-[linear-gradient(135deg,rgba(255,241,242,0.98),rgba(255,228,230,0.92))] text-rose-950',
  neutral: 'border-slate-200/80 bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(226,232,240,0.92))] text-slate-950',
};

const TONE_PILL_STYLES: Record<StatusTone, string> = {
  success: 'bg-emerald-950 text-emerald-50',
  warning: 'bg-amber-900 text-amber-50',
  danger: 'bg-rose-900 text-rose-50',
  neutral: 'bg-slate-900 text-slate-50',
};

const PREVIEW_BUTTON_BASE =
  'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60';

export default function CredentialQrVerifyPage() {
  const { token: tokenParam } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<QrVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const token = useMemo(() => parseTokenInput(tokenParam || ''), [tokenParam]);
  const verifiedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (documentPreviewUrl) {
        URL.revokeObjectURL(documentPreviewUrl);
      }
    };
  }, [documentPreviewUrl]);

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setError('Invalid verification token.');
        setIsLoading(false);
        return;
      }
      if (verifiedTokenRef.current === token) {
        return;
      }
      verifiedTokenRef.current = token;

      setIsLoading(true);
      setError(null);
      try {
        const payload = await CredentialService.verifyQrPublic(token);
        setResult(payload);
      } catch (requestError: any) {
        const message =
          requestError?.response?.data?.error ||
          requestError?.message ||
          'Unable to verify this QR token.';
        setError(message);
        setResult(null);
      } finally {
        setIsLoading(false);
      }
    };

    void verify();
  }, [token]);

  const handleOpenSharedDocument = async (mode: 'preview' | 'download') => {
    const documentToken = result?.documentAccess?.token;
    if (!documentToken) return;
    setIsLoadingDocument(true);
    setDocumentError(null);

    try {
      const blob = await CredentialService.getQrSharedDocumentBlob(documentToken, mode);
      if (mode === 'preview') {
        if (documentPreviewUrl) URL.revokeObjectURL(documentPreviewUrl);
        const objectUrl = URL.createObjectURL(blob);
        setDocumentPreviewUrl(objectUrl);
      } else {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `${result?.credential?.title || 'credential'}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      }
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.error ||
        requestError?.message ||
        'Unable to open shared document.';
      setDocumentError(message);
    } finally {
      setIsLoadingDocument(false);
    }
  };

  const summary = getSummaryConfig(result, error);
  const credential = result?.credential;
  const showDocumentActions = Boolean(
    result?.documentAccess && (result.documentAccess.previewEnabled || result.documentAccess.downloadEnabled),
  );

  return (
    <main className="credence-font min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(207,229,255,0.55),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(203,213,225,0.38),transparent_30%),linear-gradient(180deg,#f7f8fc_0%,#edf2f7_100%)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="relative overflow-hidden rounded-[34px] border border-slate-200/80 bg-white/80 shadow-[0_32px_90px_rgba(15,23,42,0.14)] backdrop-blur">
          <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_58%),linear-gradient(135deg,#111827_0%,#1f2937_48%,#0f172a_100%)]" />
          <div className="relative">
            <header className="border-b border-white/10 px-6 pb-6 pt-6 text-white sm:px-10 sm:pb-8 sm:pt-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-slate-100/90">
                    <ShieldCheck size={14} />
                    Public Proof Check
                  </p>
                  <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                    Credential Verification
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-slate-200 sm:text-base">
                    Public one-time verification for academic credentials. This page confirms the shared proof details
                    without exposing the full student record.
                  </p>
                </div>

                <div className="flex items-start justify-between gap-3 lg:flex-col lg:items-end">
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/16 hover:text-white"
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                  <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-300">Token Reference</p>
                    <p className="mt-2 font-mono text-sm font-semibold text-white">{maskToken(token)}</p>
                  </div>
                </div>
              </div>
            </header>

            <div className="space-y-6 px-6 py-6 sm:px-10 sm:py-8">
              {isLoading ? (
                <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
                  <div className="animate-pulse space-y-4">
                    <div className="h-3 w-40 rounded-full bg-slate-200" />
                    <div className="h-8 w-72 rounded-2xl bg-slate-200" />
                    <div className="h-4 w-full rounded-full bg-slate-200" />
                    <div className="h-4 w-4/5 rounded-full bg-slate-200" />
                    <div className="grid grid-cols-1 gap-4 pt-4 lg:grid-cols-3">
                      <div className="h-20 rounded-3xl bg-slate-100" />
                      <div className="h-20 rounded-3xl bg-slate-100" />
                      <div className="h-20 rounded-3xl bg-slate-100" />
                    </div>
                  </div>
                  <p className="mt-5 text-sm font-medium text-slate-600">
                    Verifying the one-time proof against the public credential record...
                  </p>
                </section>
              ) : (
                <>
                  <section className={twMerge('rounded-[28px] border p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]', SUMMARY_STYLES[summary.tone])}>
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex gap-4">
                        <div className={twMerge('mt-1 inline-flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm', TONE_PILL_STYLES[summary.tone])}>
                          <summary.icon size={24} />
                        </div>
                        <div className="max-w-2xl">
                          <p className="text-[11px] font-black uppercase tracking-[0.26em] opacity-70">
                            Verification Summary
                          </p>
                          <h2 className="mt-2 text-2xl font-black tracking-tight">{summary.title}</h2>
                          <p className="mt-2 text-sm leading-7 opacity-90 sm:text-[15px]">{summary.body}</p>
                          <p className="mt-3 text-sm font-medium opacity-75">{summary.note}</p>
                        </div>
                      </div>

                      {credential && result?.valid && (
                        <div className="grid grid-cols-2 gap-3 sm:min-w-[290px]">
                          <div className="rounded-2xl border border-black/8 bg-white/55 px-4 py-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Network</p>
                            <p className="mt-2 text-sm font-bold text-slate-900">{credential.chain || 'Off-chain'}</p>
                          </div>
                          <div className="rounded-2xl border border-black/8 bg-white/55 px-4 py-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Status</p>
                            <div className="mt-2">
                              <Badge status={credential.status} className="text-sm" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {credential && result?.valid && (
                    <>
                      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                        <SectionCard
                          eyebrow="Credential Proof"
                          title="Verified academic credential"
                          description="Publicly shared proof details for third-party validation."
                        >
                          <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-5">
                            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Credential Title</p>
                                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                                  {credential.title}
                                </h3>
                                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                                  This proof confirms the issuing institution and lifecycle status of the credential that
                                  was shared through the one-time public token.
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-sky-800">
                                  {credential.type}
                                </span>
                                <Badge status={credential.status} />
                              </div>
                            </div>

                            <div className="mt-4">
                              <DetailItem
                                icon={<School size={15} />}
                                label="Institution"
                                value={credential.institutionName}
                                emphasize
                              />
                              <DetailItem
                                icon={<FileBadge2 size={15} />}
                                label="Credential Type"
                                value={credential.type}
                              />
                              <DetailItem
                                icon={<CheckCircle2 size={15} />}
                                label="Issuance Status"
                                value={<Badge status={credential.status} />}
                              />
                              <DetailItem
                                icon={<Clock3 size={15} />}
                                label="Issued On"
                                value={formatDateTime(credential.issuedDate)}
                              />
                              <DetailItem
                                icon={<Clock3 size={15} />}
                                label="Expiry"
                                value={formatDateTime(credential.expiryDate)}
                              />
                              <DetailItem
                                icon={<ShieldCheck size={15} />}
                                label="Blockchain Network"
                                value={credential.chain || 'Not anchored'}
                              />
                            </div>
                          </div>
                        </SectionCard>

                        <SectionCard
                          eyebrow="Student Identity"
                          title="Limited public identity"
                          description="Only the minimum holder information needed for public proof checking is shown."
                          className="bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.98))]"
                        >
                          <div className="space-y-4">
                            <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5">
                              <div className="flex items-center gap-4">
                                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                                  <UserRound size={22} />
                                </div>
                                <div>
                                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Credential Holder</p>
                                  <p className="mt-1 text-xl font-black tracking-tight text-slate-950">
                                    {credential.studentOwner}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-500">Public identity is intentionally minimized.</p>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                              <DetailItem
                                icon={<GraduationCap size={15} />}
                                label="Credential Holder"
                                value={credential.studentOwner}
                              />
                              <DetailItem
                                icon={<Hash size={15} />}
                                label="Student Number"
                                value={credential.studentNumber || '-'}
                              />
                            </div>
                          </div>
                        </SectionCard>
                      </section>

                      {showDocumentActions && result.documentAccess && (
                        <SectionCard
                          eyebrow="Shared Document"
                          title="Protected document access"
                          description="Document preview and download remain separately token-controlled even after public proof verification."
                        >
                          <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                              <div className="flex items-start gap-3">
                                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                                  <LockKeyhole size={18} />
                                </div>
                                <div>
                                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Access Window</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">
                                    Expires {formatDateTime(result.documentAccess.expiresAt)}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    Only the allowed actions for this share token are shown below.
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-3">
                                {result.documentAccess.previewEnabled && (
                                  <button
                                    type="button"
                                    onClick={() => void handleOpenSharedDocument('preview')}
                                    disabled={isLoadingDocument}
                                    className={twMerge(
                                      PREVIEW_BUTTON_BASE,
                                      'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100',
                                    )}
                                  >
                                    <Eye size={16} />
                                    {isLoadingDocument ? <ButtonLoadingContent label="Opening" /> : 'Preview document'}
                                  </button>
                                )}
                                {result.documentAccess.downloadEnabled && (
                                  <button
                                    type="button"
                                    onClick={() => void handleOpenSharedDocument('download')}
                                    disabled={isLoadingDocument}
                                    className={twMerge(
                                      PREVIEW_BUTTON_BASE,
                                      'border border-slate-900 bg-slate-900 text-white hover:bg-slate-800',
                                    )}
                                  >
                                    <Download size={16} />
                                    {isLoadingDocument ? <ButtonLoadingContent label="Preparing" /> : 'Download document'}
                                  </button>
                                )}
                              </div>
                            </div>

                            {documentError && (
                              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                                {documentError}
                              </div>
                            )}

                            {documentPreviewUrl && (
                              <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
                                <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                                  <FileSearch size={16} />
                                  Shared credential preview
                                </div>
                                <iframe src={documentPreviewUrl} title="Shared credential preview" className="h-[560px] w-full bg-white" />
                              </div>
                            )}
                          </div>
                        </SectionCard>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
