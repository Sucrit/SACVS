import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, FileText, Link2, MoreHorizontal, Plus, Search, Share2, X } from 'lucide-react';
import QRCode from 'qrcode';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import Card from '../../../components/common/Card';
import {
  Credential,
  CredentialService,
  CredentialType,
  GeneratedQrTokenResponse,
} from '../../../services/credential.service';

type CredentialTypeFilter = 'ALL' | CredentialType;
type DateRangeFilter = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH';

interface StudentCredentialsSectionProps {
  credentials: Credential[];
  isLoadingCredentials: boolean;
  selectedCredentialId: string | null;
  onSelectCredential: (credentialId: string) => void;
  onOpenDetails: (credentialId: string) => void;
  onRefresh: () => void;
  heading?: string;
}

const typeFilters: CredentialTypeFilter[] = ['ALL', 'TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'];
const dateRangeFilters: Array<{ value: DateRangeFilter; label: string }> = [
  { value: 'ALL', label: 'All time' },
  { value: 'TODAY', label: 'Today' },
  { value: 'THIS_WEEK', label: 'This week' },
  { value: 'THIS_MONTH', label: 'This month' },
];

const paperTextureStyle = {
  backgroundColor: '#ffffff',
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg width='90' height='90' viewBox='0 0 90 90' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%230f172a' fill-opacity='0.04'%3E%3Ccircle cx='10' cy='10' r='1.3'/%3E%3Ccircle cx='45' cy='25' r='1.3'/%3E%3Ccircle cx='75' cy='52' r='1.3'/%3E%3Ccircle cx='20' cy='70' r='1.3'/%3E%3C/g%3E%3C/svg%3E\")",
};

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
      <div className="flex h-36 w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500">
        <FileText size={24} />
        <p className="text-xs font-semibold uppercase tracking-[0.08em]">This credential has been revoked.</p>
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
        <div className="flex h-36 w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500">
          <FileText size={24} />
          <p className="text-xs font-medium">Rendering PDF Preview...</p>
        </div>
      );
    }
  }

  return (
    <div className="flex h-36 w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500">
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
  onRefresh,
  heading,
}: StudentCredentialsSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<CredentialTypeFilter>('ALL');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('ALL');
  const [shareCredential, setShareCredential] = useState<Credential | null>(null);
  const [qrToken, setQrToken] = useState<GeneratedQrTokenResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrSecondsRemaining, setQrSecondsRemaining] = useState(0);
  const [allowDocumentPreview, setAllowDocumentPreview] = useState(false);
  const [allowDocumentDownload, setAllowDocumentDownload] = useState(false);

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
          setQrError('Unable to render QR code.');
        }
      }
    };

    void renderQr();
    return () => {
      cancelled = true;
    };
  }, [qrToken?.verificationUrl]);

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
    setQrError(null);
    setQrDataUrl(null);
    try {
      const generated = await CredentialService.generateQrToken(credential.id, {
        allowDocumentPreview: false,
        allowDocumentDownload: false,
      });
      setQrToken(generated);
    } catch {
      setQrToken(null);
      setQrError('Unable to generate one-time QR. Please try again.');
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
    setQrError(null);
    setQrDataUrl(null);
    try {
      const generated = await CredentialService.generateQrToken(shareCredential.id, {
        allowDocumentPreview,
        allowDocumentDownload,
      });
      setQrToken(generated);
    } catch {
      setQrError('Unable to regenerate one-time QR. Please try again.');
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

  return (
    <Card>
      <div className="space-y-5">
        {heading && <h2 className="text-2xl font-semibold text-slate-900">{heading}</h2>}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search credentials..."
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-slate-300"
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <select
              value={typeFilter}
              onChange={event => setTypeFilter(event.target.value as CredentialTypeFilter)}
              className="h-10 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-slate-300"
              aria-label="Filter credentials by type"
            >
              <option value="ALL">All types</option>
              {typeFilters
                .filter(filter => filter !== 'ALL')
                .map(filter => (
                  <option key={filter} value={filter}>
                    {filter}
                  </option>
                ))}
            </select>
            <select
              value={dateFilter}
              onChange={event => setDateFilter(event.target.value as DateRangeFilter)}
              className="h-10 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-slate-300"
              aria-label="Filter credentials by date"
            >
              {dateRangeFilters.map(filter => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Plus size={14} />
              Reload
            </button>
          </div>
        </div>
        {!qrToken && qrError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {qrError}
          </div>
        )}

        {isLoadingCredentials && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map(key => (
              <div key={key} className="h-52 animate-pulse rounded-xl border border-slate-200 bg-slate-100"></div>
            ))}
          </div>
        )}

        {!isLoadingCredentials && filteredCredentials.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No credentials match your current filter.</p>
            <p className="mt-1 text-xs text-slate-500">Try another search keyword or type filter.</p>
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
                  className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${isSelected ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'} ${isRevoked ? 'ring-1 ring-rose-200' : ''}`}
                >
                  <div className="flex flex-1 flex-col p-3" style={paperTextureStyle}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400">
                          {credential.type}
                        </p>
                        {isRevoked && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-700">
                            <AlertTriangle size={10} />
                            Revoked
                          </span>
                        )}
                      </div>
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            onSelectCredential(credential.id);
                            onOpenDetails(credential.id);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                          title="More"
                          aria-label="More"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={event => void handleShare(credential, event)}
                          disabled={isRevoked || credential.status !== 'ISSUED'}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                          title={
                            isRevoked
                              ? 'Revoked credentials cannot be shared'
                              : credential.status !== 'ISSUED'
                                ? 'Only issued credentials can be shared'
                                : 'Share'
                          }
                          aria-label="Share"
                        >
                          <Share2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={event => void handleDownload(credential, event)}
                          disabled={isRevoked}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 ${isRevoked ? 'cursor-not-allowed opacity-40' : ''}`}
                          title={isRevoked ? 'Revoked credentials cannot be downloaded' : 'Download'}
                          aria-label="Download"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="relative mb-3 overflow-hidden rounded-xl bg-slate-50">
                      <CredentialPreview credential={credential} isRevoked={isRevoked} />
                    </div>
                    <h3 className="line-clamp-2 text-center text-xl font-semibold leading-tight text-slate-900">{credential.title}</h3>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      {shareCredential && qrToken && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 px-4 py-4 sm:items-center"
          onClick={() => {
            setShareCredential(null);
            setQrToken(null);
            setQrDataUrl(null);
            setQrError(null);
          }}
        >
          <div
            className="max-h-[92vh] w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="max-h-[92vh] overflow-y-auto p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-lg font-semibold text-slate-900">Share One-Time QR</p>
              <button
                type="button"
                onClick={() => {
                  setShareCredential(null);
                  setQrToken(null);
                  setQrDataUrl(null);
                  setQrError(null);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                <X size={15} />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{shareCredential.title}</span> verification QR expires in{' '}
              <span className="font-semibold text-amber-700">{formatQrCountdown(qrSecondsRemaining)}</span>.
            </p>
            <div className="mt-4 flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="One-time credential verification QR" className="h-64 w-64" />
              ) : (
                <p className="text-sm text-slate-500">{isGeneratingQr ? 'Generating QR...' : 'Rendering QR...'}</p>
              )}
            </div>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This QR is single-use and short-lived. Regenerate if you suspect it was leaked.
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
                onClick={() => void handleRegenerateQr()}
                disabled={isGeneratingQr}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {isGeneratingQr ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>
            {qrError && <p className="mt-3 text-xs text-rose-700">{qrError}</p>}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
