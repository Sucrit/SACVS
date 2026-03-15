import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, Camera, CameraOff, CheckCircle2, Clock3, FileSearch, QrCode, XCircle } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/ui/Button';
import { useToast } from '../../../hooks/useToast';
import { ApprovalReceiptVerificationResult, CredentialService } from '../../../services/credential.service';

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

export default function InstitutionReceiptVerifySection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [receiptTokenInput, setReceiptTokenInput] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [isStartingScanner, setIsStartingScanner] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isMarkingClaimed, setIsMarkingClaimed] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [result, setResult] = useState<ApprovalReceiptVerificationResult | null>(null);
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

  const verifyReceiptToken = useCallback(async (value?: string) => {
    const raw = typeof value === 'string' ? value.trim() : receiptTokenInput.trim();
    if (!raw) {
      showToast({ variant: 'warning', message: 'Paste a receipt verification URL or token first.' });
      return;
    }

    const token = extractToken(raw);
    if (!token) {
      showToast({ variant: 'warning', message: 'Unable to read receipt token from the provided value.' });
      return;
    }
    setIsVerifying(true);
    setVerifyError(null);
    try {
      const payload = await CredentialService.verifyApprovalReceipt(token);
      setResult(payload);
      if (!payload.valid) {
        showToast({
          variant: payload.reason === 'EXPIRED' ? 'warning' : 'error',
          message:
            payload.reason === 'EXPIRED'
              ? 'Receipt token expired. Ask the student for a new receipt.'
              : 'Receipt token is invalid or already used.',
        });
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Unable to verify this approval receipt token.';
      setVerifyError(message);
      setResult(null);
      showToast({ variant: 'error', message });
    } finally {
      setIsVerifying(false);
    }
  }, [receiptTokenInput, showToast]);

  const handleMarkClaimed = useCallback(async () => {
    const requestId = result?.receipt?.requestId;
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
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Unable to mark this request as physically claimed.';
      showToast({ variant: 'error', message });
    } finally {
      setIsMarkingClaimed(false);
    }
  }, [result?.receipt?.requestId, showToast]);

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
      // Force permission prompt before initializing html5-qrcode.
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
          setReceiptTokenInput(decodedText);
          void verifyReceiptToken(decodedText);
          await stopScanner();
        },
        () => {
          // no-op decode error callback
        },
      );
      setIsScannerActive(true);
      setIsStartingScanner(false);
    } catch (error: any) {
      const errorName = error?.name ?? '';
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        setScannerError('Camera permission was denied. Allow camera access in your browser settings.');
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        setScannerError('No camera device was found. You can still paste token or URL.');
      } else {
        setScannerError('Camera scan unavailable. You can still paste token or URL.');
      }
      setIsScannerActive(false);
      setIsStartingScanner(false);
      setIsScannerOpen(false);
      scannerRef.current = null;
    }
  }, [isScannerActive, isScannerOpen, isStartingScanner, stopScanner, verifyReceiptToken]);

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
    setReceiptTokenInput(normalizedToken);
    void verifyReceiptToken(normalizedToken);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('token');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, verifyReceiptToken]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-neutral-900">Receipt Verification Portal</h3>
        </div>
        {isScannerOpen && (
          <div className="mb-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold  text-neutral-600">
              <QrCode size={13} />
              Camera Scanner
            </div>
            <div id="institution-receipt-qr-scanner" className="overflow-hidden rounded-lg bg-white min-h-[260px]" />
          </div>
        )}
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            value={receiptTokenInput}
            onChange={event => setReceiptTokenInput(event.target.value)}
            placeholder="Paste approval receipt code here..."
            className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none"
          />
          <Button
            type="button"
            onClick={() => void verifyReceiptToken()}
            disabled={!receiptTokenInput.trim()}
            size="lg"
            loading={isVerifying}
            className="rounded-xl"
          >
            Verify Code
          </Button>
          <Button
            type="button"
            onClick={() => void startScanner()}
            disabled={isStartingScanner}
            variant={isScannerActive || isScannerOpen ? 'danger' : 'secondary'}
            size="lg"
            icon={isScannerActive || isScannerOpen ? <CameraOff size={14} /> : <Camera size={14} />}
            className="rounded-xl"
          >
            {isStartingScanner ? 'Starting camera...' : isScannerActive || isScannerOpen ? 'Stop scanner' : 'Scan QR Code'}
          </Button>
        </div>

        <div className="mt-4 min-h-90">
          {!isVerifying && !verifyError && !result && (
            <div className="flex min-h-82 flex-col items-center justify-center px-6 text-center">
              <FileSearch size={40} className="mb-4 text-neutral-400" />
              <p className="mt-2 max-w-xl text-sm text-neutral-600">
                Verify student approval receipts for physical pickup by scanning the QR code
                or pasting the one-time receipt token/URL above.
              </p>
            </div>
          )}

          {isVerifying && (
            <div className="flex min-h-82 flex-col items-center justify-center px-6 text-center">
              <span
                className="mb-4 inline-flex h-12 w-12 animate-spin rounded-full border-4 border-neutral-300 border-t-neutral-700"
                aria-hidden="true"
              />
              <p className="text-lg font-semibold text-neutral-900">Verifying receipt token</p>
              <p className="mt-2 max-w-xl text-sm text-neutral-600">
                Validating one-time approval token and checking current receipt status.
              </p>
            </div>
          )}

          {!isVerifying && verifyError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p className="inline-flex items-center gap-2 font-semibold">
                <AlertCircle size={15} />
                Verification failed
              </p>
              <p className="mt-1">{verifyError}</p>
            </div>
          )}

          {!isVerifying && !verifyError && result?.valid && result.receipt && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
                <p className="inline-flex items-center gap-2 text-base font-bold">
                  <CheckCircle2 size={16} />
                  Approval receipt is valid
                </p>
                <p className="mt-1 text-sm">This one-time token was accepted and consumed.</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
                <div className="space-y-1.5">
                  <p><span className="text-neutral-500">Receipt Code</span>: <span className="font-mono font-semibold text-neutral-900">{result.receipt.receiptCode}</span></p>
                  <p><span className="text-neutral-500">Request ID</span>: <span className="font-semibold text-neutral-900">{result.receipt.requestId}</span></p>
                  <p><span className="text-neutral-500">Student Name</span>: <span className="font-semibold text-neutral-900">{result.receipt.studentName}</span></p>
                  <p><span className="text-neutral-500">Student Number</span>: <span className="font-semibold text-neutral-900">{result.receipt.studentNumber || '-'}</span></p>
                  <p><span className="text-neutral-500">Credential Type</span>: <span className="font-semibold text-neutral-900">{result.receipt.type}</span></p>
                  <p><span className="text-neutral-500">Delivery Method</span>: <span className="font-semibold text-neutral-900">{result.receipt.deliveryMethod}</span></p>
                  <p><span className="text-neutral-500">Approved At</span>: <span className="font-semibold text-neutral-900">{formatDateTime(result.receipt.approvedAt)}</span></p>
                  <p><span className="text-neutral-500">Institution</span>: <span className="font-semibold text-neutral-900">{result.receipt.institutionName}</span></p>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-3">
                  {markedClaimedRequestIds.includes(result.receipt.requestId) && (
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                      Claimed marked
                    </span>
                  )}
                  <Button
                    type="button"
                    onClick={() => void handleMarkClaimed()}
                    disabled={markedClaimedRequestIds.includes(result.receipt.requestId)}
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

          {!isVerifying && !verifyError && result && !result.valid && result.reason === 'EXPIRED' && (
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

          {!isVerifying && !verifyError && result && !result.valid && result.reason !== 'EXPIRED' && (
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
