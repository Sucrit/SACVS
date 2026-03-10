import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock3, ShieldCheck, XCircle } from 'lucide-react';
import { ApprovalReceiptVerificationResult, CredentialService } from '../../services/credential.service';

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

export default function RequestReceiptVerifyPage() {
  const { token: tokenParam } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<ApprovalReceiptVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const token = useMemo(() => parseTokenInput(tokenParam || ''), [tokenParam]);
  const verifiedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setError('Invalid receipt verification token.');
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
        const payload = await CredentialService.verifyApprovalReceipt(token);
        setResult(payload);
      } catch (requestError: any) {
        const message =
          requestError?.response?.data?.error ||
          requestError?.message ||
          'Unable to verify this approval receipt token.';
        setError(message);
        setResult(null);
      } finally {
        setIsLoading(false);
      }
    };

    void verify();
  }, [token]);

  return (
    <main className="credence-font min-h-screen bg-white px-4 py-8 sm:py-10">
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.10)]">
        <div className="border-b border-neutral-200 bg-neutral-900 px-6 py-5 text-white sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-2xl font-black tracking-tight">
                <ShieldCheck size={22} />
                Approval Receipt Verification
              </p>
              <p className="mt-1 text-sm text-neutral-300">Public one-time validation for approved physical pickup requests.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
            >
              Back
            </button>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6 sm:px-8 sm:py-7">
          {isLoading && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6">
              <p className="text-sm font-medium text-neutral-600">Verifying approval receipt token...</p>
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
              <p className="inline-flex items-center gap-2 text-base font-semibold">
                <AlertCircle size={16} />
                Verification Failed
              </p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {!isLoading && !error && result?.valid && result.receipt && (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900">
                <p className="inline-flex items-center gap-2 text-lg font-bold">
                  <CheckCircle2 size={18} />
                  Approval receipt is valid
                </p>
                <p className="mt-1 text-sm">This one-time token was accepted and consumed.</p>
              </div>

              <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div className="space-y-2 text-sm">
                  <p><span className="text-neutral-500">Receipt Code</span>: <span className="font-mono font-semibold text-neutral-900">{result.receipt.receiptCode}</span></p>
                  <p><span className="text-neutral-500">Request ID</span>: <span className="font-semibold text-neutral-900">{result.receipt.requestId}</span></p>
                  <p><span className="text-neutral-500">Student Name</span>: <span className="font-semibold text-neutral-900">{result.receipt.studentName}</span></p>
                  <p><span className="text-neutral-500">Student Number</span>: <span className="font-semibold text-neutral-900">{result.receipt.studentNumber || '-'}</span></p>
                  <p><span className="text-neutral-500">Credential Type</span>: <span className="font-semibold text-neutral-900">{result.receipt.type}</span></p>
                  <p><span className="text-neutral-500">Delivery Method</span>: <span className="font-semibold text-neutral-900">{result.receipt.deliveryMethod}</span></p>
                  <p><span className="text-neutral-500">Approved At</span>: <span className="font-semibold text-neutral-900">{formatDateTime(result.receipt.approvedAt)}</span></p>
                  <p><span className="text-neutral-500">Institution</span>: <span className="font-semibold text-neutral-900">{result.receipt.institutionName}</span></p>
                </div>
              </section>
            </div>
          )}

          {!isLoading && !error && result && !result.valid && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
              <p className="inline-flex items-center gap-2 text-base font-semibold">
                {result.reason === 'EXPIRED' ? <Clock3 size={16} /> : <XCircle size={16} />}
                {result.reason === 'EXPIRED' ? 'Receipt Token Expired' : 'Receipt Token Invalid or Used'}
              </p>
              <p className="mt-1 text-sm">
                {result.reason === 'EXPIRED'
                  ? 'This one-time receipt token has expired. Ask the student to generate a new approval receipt.'
                  : 'This one-time receipt token is invalid or already consumed. Ask the student for a new approval receipt.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
