import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Download, FileText, Link2, MoreHorizontal, Search, Share2, X } from 'lucide-react';
import QRCode from 'qrcode';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import ButtonLoadingContent from '../../../components/common/ButtonLoadingContent';
import SearchFilterModal, { SearchFilterGroup } from '../../../components/common/SearchFilterModal';
import {
  Credential,
  CredentialService,
  CredentialType,
  GeneratedQrTokenResponse,
} from '../../../services/credential.service';
import { useStepUp } from '../../../hooks/useStepUp';
import { useToast } from '../../../hooks/useToast';
import {
  MODAL_BACKDROP_VARIANTS,
  MODAL_PANEL_VARIANTS,
  MODAL_TRANSITION,
} from '../../../components/common/modal-motion';

type CredentialTypeFilter = 'ALL' | CredentialType;
type DateRangeFilter = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH';

interface StudentCredentialsSectionProps {
  credentials: Credential[];
  isLoadingCredentials: boolean;
  selectedCredentialId: string | null;
  onSelectCredential: (credentialId: string) => void;
  onOpenDetails: (credentialId: string) => void;
  heading?: string;
}

const typeFilters: CredentialTypeFilter[] = ['ALL', 'TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'];
const dateRangeFilters: Array<{ value: DateRangeFilter; label: string }> = [
  { value: 'ALL', label: 'All time' },
  { value: 'TODAY', label: 'Today' },
  { value: 'THIS_WEEK', label: 'This week' },
  { value: 'THIS_MONTH', label: 'This month' },
];



const isPdfFile = (credential: Credential) => {
  if (credential.mimeType === 'application/pdf') return true;
  const source = `${credential.filename || ''} ${credential.storageKey || ''}`.toLowerCase();
  return /\.pdf$/.test(source);
};

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const CredentialPreview = ({
  credential,
  isRevoked,
}: {
  credential: Credential;
  isRevoked: boolean;
}) => {
  const isImage = credential.mimeType?.startsWith('image/') ?? false;
  const isPdf = isPdfFile(credential);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfThumbnailDataUrl, setPdfThumbnailDataUrl] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const loadPreview = async () => {
      if (!isImage || isRevoked || !credential.storageKey) {
        setPreviewUrl(null);
        return;
      }
      try {
        const blob = await CredentialService.getDocumentBlob(credential.id);
        if (cancelled) return;
        if (isImage) {
          objectUrl = URL.createObjectURL(blob);
          setPreviewUrl(objectUrl);
          setPdfThumbnailDataUrl(null);
          return;
        }

        if (isPdf) {
          setIsPdfLoading(true);
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
          const firstPage = await pdfDoc.getPage(1);
          const viewport = firstPage.getViewport({ scale: 1 });
          const targetWidth = 520;
          const scale = targetWidth / Math.max(1, viewport.width);
          const scaledViewport = firstPage.getViewport({ scale });
          const canvas = canvasRef.current || document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) {
            setPdfThumbnailDataUrl(null);
            return;
          }
          canvas.width = Math.ceil(scaledViewport.width);
          canvas.height = Math.ceil(scaledViewport.height);
          await firstPage.render({ canvas, canvasContext: context, viewport: scaledViewport }).promise;
          if (cancelled) return;
          setPdfThumbnailDataUrl(canvas.toDataURL('image/jpeg', 0.84));
          setPreviewUrl(null);
          return;
        }

        setPreviewUrl(null);
        setPdfThumbnailDataUrl(null);
      } catch {
        if (!cancelled) setPreviewUrl(null);
        if (!cancelled) setPdfThumbnailDataUrl(null);
      } finally {
        if (!cancelled) setIsPdfLoading(false);
      }
    };

    void loadPreview();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [credential.id, credential.storageKey, isImage, isPdf, isRevoked]);

  if (isRevoked) {
    return (
      <div className="flex h-36 w-full flex-col items-center justify-center gap-2 bg-neutral-100 text-neutral-500">
        <FileText size={24} />
        <p className="text-xs font-medium uppercase tracking-wide">This credential has been revoked.</p>
      </div>
    );
  }

  if (isImage && previewUrl) {
    return (
      <img
        src={previewUrl}
        alt={credential.title}
        className="h-36 w-full bg-white object-contain"
        loading="lazy"
      />
    );
  }

  if (isPdf) {
    if (pdfThumbnailDataUrl) {
      return (
        <img
          src={pdfThumbnailDataUrl}
          alt={`${credential.title} first page`}
          className="h-36 w-full bg-white object-cover object-top"
          loading="lazy"
        />
      );
    }
    if (isPdfLoading) {
      return (
        <div className="flex h-36 w-full flex-col items-center justify-center gap-2 bg-neutral-50 text-neutral-400">
          <FileText size={24} />
          <p className="text-xs font-medium">Rendering PDF Preview...</p>
        </div>
      );
    }
  }

  return (
    <div className="flex h-36 w-full flex-col items-center justify-center gap-2 bg-neutral-50 text-neutral-400">
      <FileText size={24} />
      <p className="text-xs font-medium">{isPdf ? 'PDF Document' : 'No Preview Available'}</p>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default function StudentCredentialsSection({
  credentials,
  isLoadingCredentials,
  selectedCredentialId,
  onSelectCredential,
  onOpenDetails,
  heading,
}: StudentCredentialsSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<CredentialTypeFilter>('ALL');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('ALL');
  const [shareCredential, setShareCredential] = useState<Credential | null>(null);
  const [qrToken, setQrToken] = useState<GeneratedQrTokenResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [qrSecondsRemaining, setQrSecondsRemaining] = useState(0);
  const [allowDocumentPreview, setAllowDocumentPreview] = useState(false);
  const [allowDocumentDownload, setAllowDocumentDownload] = useState(false);
  const { requestStepUpToken, stepUpModal } = useStepUp();
  const { showToast } = useToast();

  const matchesDateRange = (value: string | null | undefined, range: DateRangeFilter) => {
    if (range === 'ALL') return true;
    if (!value) return false;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();

    if (range === 'TODAY') {
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      );
    }

    if (range === 'THIS_WEEK') {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const day = startOfToday.getDay();
      const diffToMonday = (day + 6) % 7;
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - diffToMonday);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      return date >= startOfWeek && date < endOfWeek;
    }

    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  };

  useEffect(() => {
    let cancelled = false;

    const renderQr = async () => {
      if (!qrToken?.verificationUrl) {
        setQrDataUrl(null);
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(qrToken.verificationUrl, { width: 280, margin: 1 });
        if (!cancelled) setQrDataUrl(dataUrl);
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

  const handleShare = async (credential: Credential, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (credential.status !== 'ISSUED') return;
    setShareCredential(credential);
    setAllowDocumentPreview(false);
    setAllowDocumentDownload(false);
    setIsGeneratingQr(true);
    setQrDataUrl(null);
    try {
      const generated = await CredentialService.generateQrToken(credential.id, {
        allowDocumentPreview: false,
        allowDocumentDownload: false,
      });
      setQrToken(generated);
    } catch {
      setQrToken(null);
      showToast({ variant: 'error', message: 'Unable to generate one-time QR. Please try again.' });
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handleCopyQrLink = async () => {
    if (!qrToken?.verificationUrl) return;
    try {
      await navigator.clipboard.writeText(qrToken.verificationUrl);
    } catch {
      // Ignore clipboard errors.
    }
  };

  const handleRegenerateQr = async () => {
    if (!shareCredential) return;
    setIsGeneratingQr(true);
    setQrDataUrl(null);
    try {
      const stepUpToken = allowDocumentDownload
        ? await requestStepUpToken({
            action: 'QR_DOWNLOAD_ENABLE',
            targetId: shareCredential.id,
            title: 'Confirm Download-Enabled Share',
            description: 'Enter the OTP sent to your email to enable document download in this shared QR.',
          })
        : undefined;
      const generated = await CredentialService.generateQrToken(shareCredential.id, {
        allowDocumentPreview,
        allowDocumentDownload,
      }, stepUpToken);
      setQrToken(generated);
    } catch (error) {
      if (error instanceof Error && error.message === 'STEP_UP_CANCELLED') {
        return;
      }
      showToast({ variant: 'error', message: 'Unable to regenerate one-time QR. Please try again.' });
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const formatQrCountdown = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleDownload = async (credential: Credential, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (credential.status === 'REVOKED') return;

    try {
      const blob = await CredentialService.getDocumentBlob(credential.id);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = credential.filename || `${credential.title}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Ignore client-side download errors to avoid breaking card interactions.
    }
  };

  const filteredCredentials = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return credentials.filter(credential => {
      if (typeFilter !== 'ALL' && credential.type !== typeFilter) {
        return false;
      }
      if (!matchesDateRange(credential.issuedDate || credential.createdAt, dateFilter)) {
        return false;
      }
      if (!keyword) {
        return true;
      }

      const searchable = [
        credential.title,
        credential.type,
        credential.description || '',
        credential.issuedBy?.institution?.institutionName || '',
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(keyword);
    });
  }, [credentials, dateFilter, searchTerm, typeFilter]);

  const filterGroups = useMemo<SearchFilterGroup[]>(() => [
    {
      id: 'credential-type',
      label: 'Type',
      value: typeFilter,
      defaultValue: 'ALL',
      options: typeFilters.map(filter => ({
        value: filter,
        label: filter === 'ALL' ? 'All types' : filter,
      })),
      onChange: value => setTypeFilter(value as CredentialTypeFilter),
    },
    {
      id: 'credential-date',
      label: 'Issued date',
      value: dateFilter,
      defaultValue: 'ALL',
      options: dateRangeFilters.map(filter => ({
        value: filter.value,
        label: filter.label,
      })),
      onChange: value => setDateFilter(value as DateRangeFilter),
    },
  ], [dateFilter, typeFilter]);

  return (
    <div>
      <div className="space-y-4">
        {heading && <h2 className="text-lg font-semibold text-neutral-900">{heading}</h2>}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full items-center gap-2 lg:max-w-md">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Search credentials..."
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <SearchFilterModal
              groups={filterGroups}
              description="Refine the credential gallery by type or issuance window."
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
          </div>
        </div>
        {isLoadingCredentials && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(key => (
              <div key={key} className="h-52 rounded-lg border border-neutral-200 skeleton-shimmer"></div>
            ))}
          </div>
        )}

        {!isLoadingCredentials && filteredCredentials.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 px-6 py-16 text-center">
            <p className="text-sm font-medium text-neutral-900">No credentials match your filter</p>
            <p className="mt-1 text-sm text-neutral-500">Try adjusting your search or filter criteria.</p>
          </div>
        )}

        {!isLoadingCredentials && filteredCredentials.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCredentials.map(credential => {
              const isSelected = credential.id === selectedCredentialId;
              const isRevoked = credential.status === 'REVOKED';

              return (
                <article
                  key={credential.id}
                  onClick={() => onSelectCredential(credential.id)}
                  className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-white transition-all duration-150 hover:shadow-md ${isSelected ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-neutral-200'} ${isRevoked ? 'border-error-200' : ''}`}
                >
                  <div className="flex flex-1 flex-col p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-neutral-500">
                          {credential.type}
                        </span>
                        {isRevoked && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-error-200 bg-error-50 px-1.5 py-0.5 text-[10px] font-medium text-error-700">
                            <AlertTriangle size={10} />
                            Revoked
                          </span>
                        )}
                      </div>
                      <div className="inline-flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            onSelectCredential(credential.id);
                            onOpenDetails(credential.id);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                          title="Details"
                          aria-label="Details"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={event => void handleShare(credential, event)}
                          disabled={isRevoked || credential.status !== 'ISSUED'}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 disabled:cursor-not-allowed disabled:opacity-30"
                          title="Share"
                          aria-label="Share"
                        >
                          <Share2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={event => void handleDownload(credential, event)}
                          disabled={isRevoked}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 disabled:cursor-not-allowed disabled:opacity-30"
                          title="Download"
                          aria-label="Download"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="relative mb-3 overflow-hidden rounded-md bg-neutral-50">
                      <CredentialPreview credential={credential} isRevoked={isRevoked} />
                    </div>
                    <h3 className="line-clamp-2 text-center text-sm font-semibold leading-snug text-neutral-900">{credential.title}</h3>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      <AnimatePresence>
        {shareCredential && qrToken && (
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={MODAL_BACKDROP_VARIANTS}
          transition={MODAL_TRANSITION}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-900/50 px-4 py-8 backdrop-blur-[2px] sm:items-center"
          onClick={() => {
            setShareCredential(null);
            setQrToken(null);
            setQrDataUrl(null);
          }}
        >
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={MODAL_PANEL_VARIANTS}
            transition={MODAL_TRANSITION}
            className="max-h-[92vh] w-full max-w-md overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-overlay"
            onClick={event => event.stopPropagation()}
          >
            <div className="max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Share One-Time QR</p>
                <p className="mt-0.5 text-xs text-neutral-500">Generate a short-lived, single-use verification QR.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShareCredential(null);
                  setQrToken(null);
                  setQrDataUrl(null);
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5">
            <div className="text-sm text-neutral-600 min-h-[20px]">
              {isGeneratingQr ? (
                <span className="text-neutral-500 animate-pulse">Waiting for verification...</span>
              ) : (
                <p>
                  <span className="font-medium text-neutral-900">{shareCredential.title}</span> verification QR expires in{' '}
                  <span className="font-semibold text-warning-700">{formatQrCountdown(qrSecondsRemaining)}</span>.
                </p>
              )}
            </div>
            <div className="mt-4 flex justify-center rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="One-time credential verification QR" className="h-40 w-40 sm:h-56 sm:w-56" />
              ) : (
                <p className="text-sm text-neutral-500">{isGeneratingQr ? 'Generating QR...' : 'Rendering QR...'}</p>
              )}
            </div>
            <div className="mt-3 rounded-md border border-warning-100 bg-warning-50 px-3 py-2 text-xs text-warning-700">
              This QR is single-use and short-lived. Regenerate if you suspect it was leaked.
            </div>
            <div className="mt-3 space-y-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
              <p className="text-xs font-medium text-neutral-500">Shared document access</p>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
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
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={allowDocumentDownload}
                  disabled={!allowDocumentPreview}
                  onChange={event => setAllowDocumentDownload(event.target.checked)}
                />
                Allow document download
                <span
                  className="rounded-md border border-warning-100 bg-warning-50 px-1.5 py-0.5 text-[10px] font-medium text-warning-700"
                  title="Enabling download requires OTP verification"
                >
                  OTP
                </span>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleCopyQrLink()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <Link2 size={13} />
                Copy Link
              </button>
              <button
                type="button"
                onClick={() => void handleRegenerateQr()}
                disabled={isGeneratingQr}
                className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                title={allowDocumentDownload ? 'OTP required when regenerating with download enabled' : 'Regenerate one-time QR'}
              >
                {isGeneratingQr ? <ButtonLoadingContent label="Regenerating" /> : 'Regenerate'}
                {allowDocumentDownload && (
                  <span className="rounded-md border border-warning-100 bg-warning-50 px-1.5 py-0.5 text-[10px] font-medium text-warning-700">
                    OTP
                  </span>
                )}
              </button>
            </div>
            </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
      {stepUpModal}
    </div>
  );
}
