import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  Download,
  FileBadge2,
  Fingerprint,
  Link2,
  Share2,
  Sparkles,
  QrCode,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import Card from '../../../components/common/Card';
import ButtonLoadingContent from '../../../components/common/ButtonLoadingContent';
import {
  Credential,
  CredentialService,
  GeneratedQrTokenResponse,
} from '../../../services/credential.service';
import { useStepUp } from '../../../hooks/useStepUp';
import { formatDateTime, shortenHash } from '../utils';
import { useToast } from '../../../hooks/useToast';

interface StudentCredentialDetailsSectionProps {
  selectedCredential: Credential | null;
  onBack: () => void;
}

const copyText = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // Ignore clipboard failures silently for non-secure contexts.
  }
};

const formatCredentialTypeLabel = (value: string | null | undefined) => {
  if (!value) return '-';
  return value
    .toLowerCase()
    .split('_')
    .map(part => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ');
};

const getStudentVerificationSummary = (credential: Credential) => {
  if (credential.status === 'ISSUED') {
    return 'Verification completed.';
  }
  if (credential.status === 'REVOKED') {
    return 'Credential has been revoked.';
  }
  if (credential.status === 'EXPIRED') {
    return 'Credential has expired.';
  }
  return 'Pending institution verification.';
};

export default function StudentCredentialDetailsSection({
  selectedCredential,
  onBack,
}: StudentCredentialDetailsSectionProps) {
  const { showToast } = useToast();
  const [selectedCredentialFileUrl, setSelectedCredentialFileUrl] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [qrToken, setQrToken] = useState<GeneratedQrTokenResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrSecondsRemaining, setQrSecondsRemaining] = useState(0);
  const [allowDocumentPreview, setAllowDocumentPreview] = useState(false);
  const [allowDocumentDownload, setAllowDocumentDownload] = useState(false);
  const { requestStepUpToken, stepUpModal } = useStepUp();

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const loadFile = async () => {
      if (!selectedCredential || !selectedCredential.storageKey || selectedCredential.status === 'REVOKED') {
        setSelectedCredentialFileUrl(null);
        return;
      }

      setIsLoadingFile(true);
      try {
        const blob = await CredentialService.getDocumentBlob(selectedCredential.id);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSelectedCredentialFileUrl(objectUrl);
      } catch {
        if (!cancelled) {
          setSelectedCredentialFileUrl(null);
          showToast({ variant: 'error', message: 'Unable to load credential document.' });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingFile(false);
        }
      }
    };

    void loadFile();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedCredential, showToast]);

  useEffect(() => {
    let cancelled = false;

    const renderQr = async () => {
      if (!qrToken?.verificationUrl) {
        setQrDataUrl(null);
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(qrToken.verificationUrl, {
          width: 280,
          margin: 1,
        });
        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      } catch {
        if (!cancelled) {
          setQrDataUrl(null);
          showToast({ variant: 'error', message: 'Unable to render QR code.' });
        }
      }
    };

    void renderQr();
    return () => {
      cancelled = true;
    };
  }, [qrToken?.verificationUrl, showToast]);

  useEffect(() => {
    if (!qrToken?.expiresAt) {
      setQrSecondsRemaining(0);
      return;
    }

    const updateRemaining = () => {
      const diff = Math.max(0, Math.floor((new Date(qrToken.expiresAt).getTime() - Date.now()) / 1000));
      setQrSecondsRemaining(diff);
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [qrToken?.expiresAt]);

  const selectedCredentialHasImage = selectedCredential?.mimeType?.startsWith('image/') ?? false;
  const isRevoked = selectedCredential?.status === 'REVOKED';
  const isAnchored = Boolean(
    selectedCredential?.chain ||
    selectedCredential?.txHash ||
    selectedCredential?.blockNumber !== null ||
    selectedCredential?.anchoredAt,
  );
  const issuerInstitutionName =
    selectedCredential?.issuedBy?.institution?.institutionName?.trim() || 'Your institution';
  const canGenerateQr = selectedCredential?.status === 'ISSUED';

  const handleGenerateQr = async (options?: {
    allowDocumentPreview?: boolean;
    allowDocumentDownload?: boolean;
  }) => {
    if (!selectedCredential) return;
    setIsGeneratingQr(true);
    setQrDataUrl(null);
    const previewEnabled =
      typeof options?.allowDocumentPreview === 'boolean'
        ? options.allowDocumentPreview
        : allowDocumentPreview;
    const downloadEnabled =
      typeof options?.allowDocumentDownload === 'boolean'
        ? options.allowDocumentDownload
        : allowDocumentDownload;
    try {
      const stepUpToken = downloadEnabled
        ? await requestStepUpToken({
            action: 'QR_DOWNLOAD_ENABLE',
            targetId: selectedCredential.id,
            title: 'Confirm Download-Enabled Share',
            description: 'Enter the OTP sent to your email to enable document download in this shared QR.',
          })
        : undefined;
      const generated = await CredentialService.generateQrToken(selectedCredential.id, {
        allowDocumentPreview: previewEnabled,
        allowDocumentDownload: downloadEnabled,
      }, stepUpToken);
      setQrToken(generated);
    } catch (error) {
      if (error instanceof Error && error.message === 'STEP_UP_CANCELLED') {
        return;
      }
      setQrToken(null);
      showToast({ variant: 'error', message: 'Unable to generate one-time QR. Please try again.' });
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handleCopyQrLink = async () => {
    if (!qrToken?.verificationUrl) return;
    await copyText(qrToken.verificationUrl);
  };

  const formatQrCountdown = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleShare = async () => {
    if (!canGenerateQr) return;
    setAllowDocumentPreview(false);
    setAllowDocumentDownload(false);
    await handleGenerateQr({
      allowDocumentPreview: false,
      allowDocumentDownload: false,
    });
  };

  if (!selectedCredential) {
    return (
      <Card className="rounded-3xl p-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="mt-4">
          <p className="text-xl font-semibold text-slate-900">Credential Details</p>
          <p className="mt-1 text-sm text-slate-500">Credential details are not available.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-3xl border border-slate-200 p-6 shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
            {isRevoked && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <p className="inline-flex items-center gap-2 font-semibold">
                  <AlertTriangle size={14} />
                  Revoked Credential
                </p>
                <p className="mt-1 text-xs text-rose-700/90">
                  This credential has been revoked by {issuerInstitutionName} and is no longer usable.
                </p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <div className="flex items-center gap-2">
                <FileBadge2 size={14} className="text-slate-500" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Document Preview</p>
              </div>
            </div>

            {selectedCredentialFileUrl ? (
              <>
                {isRevoked ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-16 text-center text-sm text-slate-600">
                    This credential has been revoked.
                  </div>
                ) : selectedCredentialHasImage ? (
                  <div className="h-[clamp(420px,70vh,760px)] w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <img
                      src={selectedCredentialFileUrl}
                      alt={selectedCredential.title}
                      className="block h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-8 text-center text-sm text-slate-600">
                    Inline preview is not available for this file type.
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-8 text-center text-sm text-slate-600">
                {isLoadingFile ? 'Loading credential document...' : 'No file is attached to this credential.'}
              </div>
            )}

          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Credential Details</p>
              <p className="mt-1 text-2xl font-semibold leading-tight text-slate-900">{selectedCredential.title}</p>
              <p className="mt-2 text-sm font-medium text-slate-600">
                <span className="text-slate-500">Type:</span>{' '}
                <span className="font-semibold text-slate-900">{formatCredentialTypeLabel(selectedCredential.type)}</span>
              </p>
            </div>

            <div className="grid grid-cols-[130px_1fr] items-start gap-x-3 gap-y-3 text-sm">
              <p className="inline-flex items-center gap-2 font-medium text-slate-500">
                <Sparkles size={14} />
                Status
              </p>
              <p className={`font-semibold ${isRevoked ? 'text-rose-700' : 'text-slate-900'}`}>
                {selectedCredential.status}
              </p>

              <p className="inline-flex items-center gap-2 font-medium text-slate-500">
                <CalendarDays size={14} />
                Issued
              </p>
              <p className="font-semibold text-slate-900">{formatDateTime(selectedCredential.issuedDate || selectedCredential.createdAt)}</p>

              <p className="inline-flex items-center gap-2 font-medium text-slate-500">
                <Building2 size={14} />
                Institution
              </p>
              <p className="font-semibold text-slate-900">{issuerInstitutionName}</p>

              <p className="inline-flex items-center gap-2 font-medium text-slate-500">
                <Sparkles size={14} />
                Verification
              </p>
              <p className="font-semibold text-slate-900">{getStudentVerificationSummary(selectedCredential)}</p>

              <p className="inline-flex items-center gap-2 font-medium text-slate-500">
                <Link2 size={14} />
                Blockchain
              </p>
              <div>
                <p className="font-semibold text-slate-900">{selectedCredential.chain || 'Not anchored yet'}</p>
                {isAnchored && (
                  <>
                    <p className="mt-1 text-xs text-slate-500">Block #: {selectedCredential.blockNumber ?? '-'}</p>
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
                      <code className="truncate font-mono text-slate-600">{shortenHash(selectedCredential.txHash)}</code>
                      {selectedCredential.txHash && (
                        <button
                          onClick={() => void copyText(selectedCredential.txHash as string)}
                          className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-200/60 hover:text-slate-700"
                          title="Copy transaction hash"
                        >
                          <Link2 size={12} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              <p className="inline-flex items-center gap-2 font-medium text-slate-500">
                <CalendarDays size={14} />
                Expiry Date
              </p>
              <p className="font-semibold text-slate-900">{formatDateTime(selectedCredential.expiryDate)}</p>

              <p className="inline-flex items-center gap-2 font-medium text-slate-500">
                <Fingerprint size={14} />
                File Hash
              </p>
              <p className="break-all font-semibold text-slate-900">{shortenHash(selectedCredential.fileHash)}</p>

              {selectedCredentialFileUrl && (
                <>
                  <p className="inline-flex items-center gap-2 font-medium text-slate-500">
                    <Link2 size={14} />
                    Actions
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleShare()}
                      disabled={isRevoked || !canGenerateQr || isGeneratingQr}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Share one-time QR (OTP required only if document download is enabled)"
                    >
                      <Share2 size={13} />
                      {isGeneratingQr ? <ButtonLoadingContent label="Generating" /> : 'Share'}
                    </button>
                    {isRevoked ? (
                      <button
                        type="button"
                        disabled
                        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 opacity-40"
                      >
                        <Download size={13} />
                        Download
                      </button>
                    ) : (
                      <a
                        href={selectedCredentialFileUrl}
                        download={selectedCredential.filename || `${selectedCredential.title}.pdf`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Download size={13} />
                        Download
                      </a>
                    )}
                  </div>
                </>
              )}
              {qrToken && (
                <>
                  <p className="inline-flex items-center gap-2 font-medium text-slate-500">
                    <QrCode size={14} />
                    Verification QR
                  </p>
                  <p className="text-xs font-semibold text-amber-700">
                    Expires in {formatQrCountdown(qrSecondsRemaining)}
                  </p>
                </>
              )}
            </div>
          </section>
      </div>
      {qrToken && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 px-4 py-4 sm:items-center"
          onClick={() => setQrToken(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="max-h-[92vh] overflow-y-auto p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-lg font-semibold text-slate-900">One-Time Verification QR</p>
              <button
                type="button"
                onClick={() => setQrToken(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                <X size={15} />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              This QR can be used once and expires in{' '}
              <span className="font-semibold text-amber-700">{formatQrCountdown(qrSecondsRemaining)}</span>.
            </p>
            <div className="mt-4 flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="One-time credential verification QR" className="h-64 w-64" />
              ) : (
                <p className="text-sm text-slate-500">Rendering QR...</p>
              )}
            </div>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Security notice: this link is short-lived and single-use. If leaked, regenerate immediately.
            </div>
            <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Shared document access</p>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={allowDocumentPreview}
                  onChange={event => {
                    const checked = event.target.checked;
                    setAllowDocumentPreview(checked);
                    if (!checked) setAllowDocumentDownload(false);
                  }}
                />
                Allow document preview
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={allowDocumentDownload}
                  disabled={!allowDocumentPreview}
                  onChange={event => setAllowDocumentDownload(event.target.checked)}
                />
                Allow document download
                <span
                  className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700"
                  title="Enabling download requires OTP verification"
                >
                  OTP Required
                </span>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleCopyQrLink()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Link2 size={13} />
                Copy Link
              </button>
              <button
                type="button"
                onClick={() => void handleGenerateQr()}
                disabled={isGeneratingQr}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                title={allowDocumentDownload ? 'OTP required when regenerating with download enabled' : 'Regenerate one-time QR'}
              >
                <RefreshIcon />
                {isGeneratingQr ? <ButtonLoadingContent label="Regenerating" /> : 'Regenerate'}
                {allowDocumentDownload && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                    OTP
                  </span>
                )}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
      {stepUpModal}
    </Card>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
