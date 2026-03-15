import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock3,
  FileSearch,
  Hash,
  Link2,
  QrCode,
  XCircle,
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/ui/Button';
import { useToast } from '../../../hooks/useToast';
import {
  ApprovalReceiptVerificationResult,
  CredentialService,
  ReceiptLookupResult,
} from '../../../services/credential.service';

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

type EntryMode = 'code' | 'link' | 'qr';

type VerifyResult =
  | { source: 'lookup'; data: ReceiptLookupResult }
  | { source: 'verify'; data: ApprovalReceiptVerificationResult };

const MODE_TABS: { id: EntryMode; label: string; icon: typeof Hash }[] = [
  { id: 'code', label: 'Receipt Code', icon: Hash },
  { id: 'link', label: 'Verification Link', icon: Link2 },
  { id: 'qr', label: 'Scan QR', icon: QrCode },
];

const TOKEN_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Token Active', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  EXPIRED: { label: 'Token Expired', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  USED: { label: 'Token Used', className: 'border-neutral-200 bg-neutral-50 text-neutral-600' },
  INVALIDATED: { label: 'Token Invalidated', className: 'border-rose-200 bg-rose-50 text-rose-600' },
};

export default function InstitutionReceiptVerifySection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<EntryMode>('code');
  const [codeInput, setCodeInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [isStartingScanner, setIsStartingScanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingClaimed, setIsMarkingClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [markedClaimedRequestIds, setMarkedClaimedRequestIds] = useState<string[]>([]);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);
  const tokenFromQueryHandledRef = useRef<string | null>(null);
  const { showToast } = useToast();

  const extractToken = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
      const parsed = new URL(trimmed);
      const token = parsed.pathname.split('/').filter(Boolean).pop() || '';
      return decodeURIComponent(token);
    } catch {
      return decodeURIComponent(trimmed);
    }
  };

  const handleLookupByCode = useCallback(async (value?: string) => {
    const raw = typeof value === 'string' ? value.trim() : codeInput.trim();
    const normalized = raw.toUpperCase().replace(/\s+/g, '');
    if (!normalized) {
      showToast({ variant: 'warning', message: 'Enter a receipt code first.' });
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const payload = await CredentialService.lookupReceiptByCode(normalized);
      setResult({ source: 'lookup', data: payload });
      if (!payload.found) {
        showToast({ variant: 'error', message: 'Receipt code not found.' });
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.error || err?.message || 'Unable to look up this receipt code.';
      setError(message);
      setResult(null);
      showToast({ variant: 'error', message });
    } finally {
      setIsLoading(false);
    }
  }, [codeInput, showToast]);

  const handleVerifyToken = useCallback(async (value?: string) => {
    const raw = typeof value === 'string' ? value.trim() : linkInput.trim();
    if (!raw) {
      showToast({ variant: 'warning', message: 'Paste a verification URL or token first.' });
      return;
    }

    const token = extractToken(raw);
    if (!token) {
      showToast({ variant: 'warning', message: 'Unable to read receipt token from the provided value.' });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const payload = await CredentialService.verifyApprovalReceipt(token);
      setResult({ source: 'verify', data: payload });
      if (!payload.valid) {
        showToast({
          variant: payload.reason === 'EXPIRED' ? 'warning' : 'error',
          message:
            payload.reason === 'EXPIRED'
              ? 'Receipt token expired. Ask the student for a new receipt.'
              : 'Receipt token is invalid or already used.',
        });
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.error || err?.message || 'Unable to verify this approval receipt token.';
      setError(message);
      setResult(null);
      showToast({ variant: 'error', message });
    } finally {
      setIsLoading(false);
    }
  }, [linkInput, showToast]);

  const handleSubmit = useCallback(() => {
    if (mode === 'code') {
      void handleLookupByCode();
    } else if (mode === 'link') {
      void handleVerifyToken();
    }
  }, [mode, handleLookupByCode, handleVerifyToken]);

  const handleMarkClaimed = useCallback(async () => {
    const receipt =
      result?.source === 'lookup' ? result.data.receipt :
      result?.source === 'verify' ? result.data.receipt :
      null;
    const requestId = receipt?.requestId;
    if (!requestId) return;

    setIsMarkingClaimed(true);
    try {
      await CredentialService.markPhysicalClaimed(requestId);
      setMarkedClaimedRequestIds(previous =>
        previous.includes(requestId) ? previous : [...previous, requestId],
      );
      showToast({
        variant: 'success',
        message: 'Physical claim recorded. Request marked as completed.',
      });
    } catch (err: any) {
      const message =
        err?.response?.data?.error || err?.message || 'Unable to mark this request as physically claimed.';
      showToast({ variant: 'error', message });
    } finally {
      setIsMarkingClaimed(false);
    }
  }, [result, showToast]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      await scanner.stop();
      await scanner.clear();
    } catch {
      // Ignore scanner stop/clear failures.
    } finally {
      scannerRef.current = null;
      setIsScannerActive(false);
      setIsStartingScanner(false);
      setIsScannerOpen(false);
    }
  }, []);

  const startScanner = useCallback(async () => {
    setScannerError(null);
    if (isScannerActive || isScannerOpen || isStartingScanner) {
      await stopScanner();
      return;
    }

    if (!window.isSecureContext) {
      setScannerError('Camera scanning requires a secure context (HTTPS or localhost).');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError('This browser does not support camera access.');
      return;
    }

    setIsScannerOpen(true);
    setIsStartingScanner(true);
    await new Promise(resolve => window.setTimeout(resolve, 0));

    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      permissionStream.getTracks().forEach(track => track.stop());

      const moduleName = 'html5-qrcode';
      const scannerModule: any = await import(/* @vite-ignore */ moduleName);
      const Html5Qrcode = scannerModule.Html5Qrcode;
      const devices = await Html5Qrcode.getCameras();
      const preferredCamera = devices[0]?.id ?? { facingMode: 'environment' };
      const scanner = new Html5Qrcode('institution-receipt-qr-scanner');
      scannerRef.current = scanner;
      await scanner.start(
        preferredCamera,
        { fps: 10, qrbox: 220 },
        async (decodedText: string) => {
          setLinkInput(decodedText);
          void handleVerifyToken(decodedText);
          await stopScanner();
        },
        () => {
          // no-op decode error callback
        },
      );
      setIsScannerActive(true);
      setIsStartingScanner(false);
    } catch (err: any) {
      const errorName = err?.name ?? '';
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        setScannerError('Camera permission was denied. Allow camera access in your browser settings.');
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        setScannerError('No camera device was found. You can still paste a verification link.');
      } else {
        setScannerError('Camera scan unavailable. You can still paste a verification link.');
      }
      setIsScannerActive(false);
      setIsStartingScanner(false);
      setIsScannerOpen(false);
      scannerRef.current = null;
    }
  }, [isScannerActive, isScannerOpen, isStartingScanner, stopScanner, handleVerifyToken]);

  const switchMode = useCallback(async (newMode: EntryMode) => {
    if (newMode !== 'qr' && (isScannerActive || isScannerOpen)) {
      await stopScanner();
    }
    setMode(newMode);
    setResult(null);
    setError(null);
  }, [isScannerActive, isScannerOpen, stopScanner]);

  useEffect(() => {
    if (!scannerError) return;
    showToast({ variant: 'warning', message: scannerError });
  }, [scannerError, showToast]);

  useEffect(() => {
    const rawToken = searchParams.get('token');
    const normalizedToken = rawToken ? extractToken(rawToken) : '';
    if (!normalizedToken) return;
    if (tokenFromQueryHandledRef.current === normalizedToken) return;

    tokenFromQueryHandledRef.current = normalizedToken;
    setMode('link');
    setLinkInput(normalizedToken);
    void handleVerifyToken(normalizedToken);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('token');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, handleVerifyToken]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  const receiptData =
    result?.source === 'lookup' ? result.data.receipt :
    result?.source === 'verify' && result.data.valid ? result.data.receipt :
    null;

  const isValid =
    result?.source === 'lookup' ? result.data.found :
    result?.source === 'verify' ? result.data.valid :
    false;

  return (
    <div className="space-y-6">
      <Card title="Receipt Verification Portal">
        {/* Mode tabs */}
        <div className="mb-4 flex gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-1">
          {MODE_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => void switchMode(tab.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Receipt Code mode */}
        {mode === 'code' && (
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative flex-1">
              <input
                value={codeInput}
                onChange={event => setCodeInput(event.target.value.toUpperCase())}
                onKeyDown={event => event.key === 'Enter' && handleSubmit()}
                placeholder="APR-179ABA73"
                className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 font-mono text-sm tracking-wide outline-none focus:border-neutral-300"
              />
            </div>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!codeInput.trim()}
              size="lg"
              loading={isLoading}
              className="rounded-xl"
            >
              Look Up
            </Button>
          </div>
        )}

        {/* Verification Link mode */}
        {mode === 'link' && (
          <div className="flex flex-col gap-2 md:flex-row">
            <input
              value={linkInput}
              onChange={event => setLinkInput(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && handleSubmit()}
              placeholder="Paste verification URL or token..."
              className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none focus:border-neutral-300"
            />
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!linkInput.trim()}
              size="lg"
              loading={isLoading}
              className="rounded-xl"
            >
              Verify Token
            </Button>
          </div>
        )}

        {/* Scan QR mode */}
        {mode === 'qr' && (
          <div className="space-y-3">
            {isScannerOpen && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-neutral-600">
                  <QrCode size={13} />
                  Camera Scanner
                </div>
                <div id="institution-receipt-qr-scanner" className="overflow-hidden rounded-lg bg-white min-h-[260px]" />
              </div>
            )}
            <Button
              type="button"
              onClick={() => void startScanner()}
              disabled={isStartingScanner}
              variant={isScannerActive || isScannerOpen ? 'danger' : 'secondary'}
              size="lg"
              icon={isScannerActive || isScannerOpen ? <CameraOff size={14} /> : <Camera size={14} />}
              className="w-full rounded-xl"
            >
              {isStartingScanner ? 'Starting camera...' : isScannerActive || isScannerOpen ? 'Stop scanner' : 'Start QR Scanner'}
            </Button>
          </div>
        )}

        {/* Results area */}
        <div className="mt-4 min-h-90">
          {/* Empty state */}
          {!isLoading && !error && !result && (
            <div className="flex min-h-82 flex-col items-center justify-center px-6 text-center">
              <FileSearch size={40} className="mb-4 text-neutral-400" />
              <p className="mt-2 max-w-xl text-sm text-neutral-600">
                {mode === 'code'
                  ? 'Enter the short receipt code from the student\'s approval receipt to look up verification details.'
                  : mode === 'link'
                    ? 'Paste the one-time receipt verification URL or raw token to consume and verify the receipt.'
                    : 'Scan the QR code from the student\'s approval receipt to verify and consume the one-time token.'
                }
              </p>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex min-h-82 flex-col items-center justify-center px-6 text-center">
              <span
                className="mb-4 inline-flex h-12 w-12 animate-spin rounded-full border-4 border-neutral-300 border-t-neutral-700"
                aria-hidden="true"
              />
              <p className="text-lg font-semibold text-neutral-900">
                {mode === 'code' ? 'Looking up receipt' : 'Verifying receipt token'}
              </p>
              <p className="mt-2 max-w-xl text-sm text-neutral-600">
                {mode === 'code'
                  ? 'Searching for the receipt by code.'
                  : 'Validating one-time approval token and checking current receipt status.'
                }
              </p>
            </div>
          )}

          {/* Network / server error */}
          {!isLoading && error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p className="inline-flex items-center gap-2 font-semibold">
                <AlertCircle size={15} />
                {mode === 'code' ? 'Lookup failed' : 'Verification failed'}
              </p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {/* Successful result with receipt data */}
          {!isLoading && !error && isValid && receiptData && (
            <div className="space-y-3">
              <div className={`rounded-lg border px-4 py-3 ${
                result?.source === 'lookup'
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900'
              }`}>
                <p className="inline-flex items-center gap-2 text-base font-bold">
                  <CheckCircle2 size={16} />
                  {result?.source === 'lookup' ? 'Receipt found' : 'Approval receipt is valid'}
                </p>
                <p className="mt-1 text-sm">
                  {result?.source === 'lookup'
                    ? 'Receipt looked up by code. This is a non-consumptive lookup.'
                    : 'This one-time token was accepted and consumed.'
                  }
                </p>
              </div>

              {/* Token status badge for lookup */}
              {result?.source === 'lookup' && result.data.tokenStatus && (
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TOKEN_STATUS_LABELS[result.data.tokenStatus]?.className ?? ''}`}>
                    {TOKEN_STATUS_LABELS[result.data.tokenStatus]?.label ?? result.data.tokenStatus}
                  </span>
                </div>
              )}

              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
                <div className="space-y-1.5">
                  <p><span className="text-neutral-500">Receipt Code</span>: <span className="font-mono font-semibold text-neutral-900">{receiptData.receiptCode}</span></p>
                  <p><span className="text-neutral-500">Request ID</span>: <span className="font-semibold text-neutral-900">{receiptData.requestId}</span></p>
                  <p><span className="text-neutral-500">Student Name</span>: <span className="font-semibold text-neutral-900">{receiptData.studentName}</span></p>
                  <p><span className="text-neutral-500">Student Number</span>: <span className="font-semibold text-neutral-900">{receiptData.studentNumber || '-'}</span></p>
                  <p><span className="text-neutral-500">Credential Type</span>: <span className="font-semibold text-neutral-900">{receiptData.type}</span></p>
                  <p><span className="text-neutral-500">Delivery Method</span>: <span className="font-semibold text-neutral-900">{receiptData.deliveryMethod}</span></p>
                  <p><span className="text-neutral-500">Approved At</span>: <span className="font-semibold text-neutral-900">{formatDateTime(receiptData.approvedAt)}</span></p>
                  <p><span className="text-neutral-500">Institution</span>: <span className="font-semibold text-neutral-900">{receiptData.institutionName}</span></p>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-3">
                  {markedClaimedRequestIds.includes(receiptData.requestId) && (
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                      Claimed marked
                    </span>
                  )}
                  <Button
                    type="button"
                    onClick={() => void handleMarkClaimed()}
                    disabled={markedClaimedRequestIds.includes(receiptData.requestId)}
                    size="sm"
                    loading={isMarkingClaimed}
                    className="rounded-lg"
                  >
                    Mark as claimed
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Lookup not found */}
          {!isLoading && !error && result?.source === 'lookup' && !result.data.found && (
            <div className="flex min-h-82 flex-col items-center justify-center px-6 text-center">
              <XCircle size={40} className="mb-4 text-rose-500" />
              <p className="text-lg font-semibold text-neutral-900">Receipt code not found</p>
              <p className="mt-2 max-w-xl text-sm text-neutral-600">
                No receipt matches this code. Check for typos or ask the student for the correct code.
              </p>
            </div>
          )}

          {/* Verify: expired */}
          {!isLoading && !error && result?.source === 'verify' && !result.data.valid && result.data.reason === 'EXPIRED' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
              <p className="inline-flex items-center gap-2 font-semibold">
                <Clock3 size={15} />
                Receipt token expired
              </p>
              <p className="mt-1 text-sm">
                This one-time receipt token has expired. Ask the student to generate a new receipt.
              </p>
            </div>
          )}

          {/* Verify: invalid/used */}
          {!isLoading && !error && result?.source === 'verify' && !result.data.valid && result.data.reason !== 'EXPIRED' && (
            <div className="flex min-h-82 flex-col items-center justify-center px-6 text-center">
              <XCircle size={40} className="mb-4 text-rose-500" />
              <p className="text-lg font-semibold text-neutral-900">Receipt token invalid or used</p>
              <p className="mt-2 max-w-xl text-sm text-neutral-600">
                This one-time receipt token is invalid or already consumed. Ask the student for a new receipt if you think this is a mistake.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
