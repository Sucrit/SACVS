import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
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
  ShieldCheck,
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

interface SummaryConfig {
  title: string;
  body: string;
  note: string;
  mediaSrc: string;
  mediaLabel: string;
  shortDeniedMessage?: string;
}

interface DetailItemProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  emphasize?: boolean;
}

function DetailItem({ icon, label, value, emphasize = false }: DetailItemProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-neutral-200 py-3 last:border-b-0 last:pb-0 first:pt-0">
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-500">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
          {icon}
        </span>
        {label}
      </div>
      <div className={twMerge('text-right text-sm font-semibold text-neutral-900', emphasize && 'text-base')}>
        {value}
      </div>
    </div>
  );
}

function FlatSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-neutral-200 bg-white px-4 py-4 sm:px-5 sm:py-5">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-black tracking-tight text-neutral-950">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-neutral-600">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const getSummaryConfig = (result: QrVerificationResult | null, error: string | null): SummaryConfig => {
  if (error) {
    return {
      title: 'Verification unavailable',
      body: error,
      note: 'The proof could not be completed from this request. Check the QR source and try again.',
      mediaSrc: '/denied_state_public_verif.mp4',
      mediaLabel: 'Verification denied',
      shortDeniedMessage: 'Verification unavailable.',
    };
  }

  if (!result) {
    return {
      title: 'Preparing verification',
      body: 'The one-time token is being checked against the public credential proof workflow.',
      note: 'Please wait while the request is validated.',
      mediaSrc: '',
      mediaLabel: '',
    };
  }

  if (result.valid) {
    return {
      title: 'Verified credential proof',
      body: 'This one-time proof was accepted and confirms the credential details shown below.',
      note: 'This confirms the public proof only. Shared documents remain separately token-protected.',
      mediaSrc: '/success_state_public_verif.mp4',
      mediaLabel: 'Verified credential proof',
    };
  }

  if (result.reason === 'EXPIRED') {
    return {
      title: 'Verification token expired',
      body: 'This public proof link is no longer active and cannot be used to confirm the credential.',
      note: 'Ask the credential holder to generate a new public verification token.',
      mediaSrc: '/denied_state_public_verif.mp4',
      mediaLabel: 'Verification denied',
      shortDeniedMessage: 'Token expired.',
    };
  }

  if (result.reason === 'USED') {
    return {
      title: 'Token already used',
      body: 'This one-time proof has already been consumed and cannot be used again.',
      note: 'Ask the credential holder to share a fresh public verification token.',
      mediaSrc: '/denied_state_public_verif.mp4',
      mediaLabel: 'Verification denied',
      shortDeniedMessage: 'Token already used.',
    };
  }

  return {
    title: 'Invalid verification token',
    body: 'This QR token could not be matched to an active public credential proof.',
    note: 'Confirm that the full verification link was opened and request a new token if needed.',
    mediaSrc: '/denied_state_public_verif.mp4',
    mediaLabel: 'Verification denied',
    shortDeniedMessage: 'Verification denied.',
  };
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
    <main className="credence-font credence-page-bg min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.86),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(229,231,235,0.55),transparent_30%)] px-4 py-5 text-neutral-900 antialiased sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="rounded-[28px] border border-neutral-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <header className="border-b border-neutral-200 px-5 py-4 sm:px-8 sm:py-4.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-3xl">
                <h1 className="text-[1.65rem] font-black tracking-tight text-neutral-950 sm:text-[1.9rem]">
                  Credential Verification
                </h1>
              </div>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 self-start rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            </div>
          </header>

          <div className="space-y-4 px-5 py-4 sm:px-8 sm:py-5">
            {isLoading ? (
              <section className="rounded-[20px] border border-neutral-200 bg-white px-4 py-4 sm:px-5 sm:py-5">
                <div className="animate-pulse space-y-4">
                  <div className="h-3 w-40 rounded-full bg-neutral-200" />
                  <div className="h-8 w-72 rounded-2xl bg-neutral-200" />
                  <div className="h-4 w-full rounded-full bg-neutral-200" />
                  <div className="h-4 w-4/5 rounded-full bg-neutral-200" />
                </div>
                <p className="mt-5 text-sm font-medium text-neutral-600">
                  Verifying the one-time proof against the public credential record...
                </p>
              </section>
            ) : (
              <>
                {!result?.valid && (
                  <section className="border-b border-neutral-200 px-0 pb-4 pt-0.5 sm:pb-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      {summary.mediaSrc ? (
                        <div className="shrink-0">
                          {summary.shortDeniedMessage ? (
                            <p className="mb-2 text-sm font-semibold text-neutral-700">
                              {summary.shortDeniedMessage}
                            </p>
                          ) : null}
                          <video
                            className="h-20 w-auto object-contain sm:h-24"
                            autoPlay
                            muted
                            loop
                            playsInline
                            aria-label={summary.mediaLabel}
                          >
                            <source src={summary.mediaSrc} type="video/mp4" />
                          </video>
                        </div>
                      ) : null}
                    </div>
                  </section>
                )}

                {credential && result?.valid && (
                  <>
                    <FlatSection
                      eyebrow="Verified Details"
                      title="Credential proof and holder identity"
                      description="Publicly shared proof details with limited student identity for third-party validation."
                    >
                      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
                        <div>
                          <div className="flex flex-col gap-4 border-b border-neutral-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">
                                Credential Title
                              </p>
                              <h3 className="mt-2 text-2xl font-black tracking-tight text-neutral-950">
                                {credential.title}
                              </h3>
                              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                                This proof confirms the issuing institution, lifecycle status, and limited holder identity
                                associated with the one-time public token.
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-sky-800">
                                {credential.type}
                              </span>
                              <Badge status={credential.status} />
                            </div>
                          </div>

                          <div className="mt-5">
                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">
                              Credential Proof
                            </p>
                            <div className="mt-3">
                              <DetailItem icon={<School size={15} />} label="Institution" value={credential.institutionName} emphasize />
                              <DetailItem icon={<FileBadge2 size={15} />} label="Credential Type" value={credential.type} />
                              <DetailItem icon={<CheckCircle2 size={15} />} label="Issuance Status" value={<Badge status={credential.status} />} />
                              <DetailItem icon={<Clock3 size={15} />} label="Issued On" value={formatDateTime(credential.issuedDate)} />
                              <DetailItem icon={<Clock3 size={15} />} label="Expiry" value={formatDateTime(credential.expiryDate)} />
                              <DetailItem icon={<ShieldCheck size={15} />} label="Blockchain Network" value={credential.chain || 'Not anchored'} />
                            </div>
                          </div>

                          <div className="mt-6 border-t border-neutral-200 pt-5">
                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">
                              Student Identity
                            </p>
                            <p className="mt-3 text-lg font-black tracking-tight text-neutral-950">
                              {credential.studentOwner}
                            </p>
                            <p className="mt-1 text-sm text-neutral-500">
                              Public identity is intentionally minimized.
                            </p>

                            <div className="mt-4">
                              <DetailItem icon={<GraduationCap size={15} />} label="Credential Holder" value={credential.studentOwner} />
                              <DetailItem icon={<Hash size={15} />} label="Student Number" value={credential.studentNumber || '-'} />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start justify-center xl:justify-end">
                          <video
                            className="h-44 w-auto object-contain sm:h-52 xl:h-56"
                            autoPlay
                            muted
                            loop
                            playsInline
                            aria-label="Verified credential proof"
                          >
                            <source src="/success_state_public_verif.mp4" type="video/mp4" />
                          </video>
                        </div>
                      </div>
                    </FlatSection>

                    {showDocumentActions && result.documentAccess && (
                      <FlatSection
                        eyebrow="Shared Document"
                        title="Protected document access"
                        description="Document preview and download remain separately token-controlled even after public proof verification."
                      >
                        <div className="flex flex-col gap-4 border-b border-neutral-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-start gap-3">
                            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-900 text-white">
                              <LockKeyhole size={18} />
                            </div>
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">
                                Access Window
                              </p>
                              <p className="mt-1 text-sm font-semibold text-neutral-900">
                                Expires {formatDateTime(result.documentAccess.expiresAt)}
                              </p>
                              <p className="mt-1 text-sm text-neutral-600">
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
                                  'border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100',
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
                                  'border border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800',
                                )}
                              >
                                <Download size={16} />
                                {isLoadingDocument ? <ButtonLoadingContent label="Preparing" /> : 'Download document'}
                              </button>
                            )}
                          </div>
                        </div>

                        {documentError && (
                          <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                            {documentError}
                          </div>
                        )}

                        {documentPreviewUrl && (
                          <div className="mt-5 overflow-hidden rounded-[18px] border border-neutral-200 bg-white">
                            <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700">
                              <FileSearch size={16} />
                              Shared credential preview
                            </div>
                            <iframe src={documentPreviewUrl} title="Shared credential preview" className="h-[560px] w-full bg-white" />
                          </div>
                        )}
                      </FlatSection>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
