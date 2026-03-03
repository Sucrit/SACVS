import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock3, ShieldCheck, XCircle } from 'lucide-react';
import { CredentialService, QrVerificationResult } from '../../services/credential.service';

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

export default function CredentialQrVerifyPage() {
  const { token: tokenParam } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<QrVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const token = useMemo(() => parseTokenInput(tokenParam || ''), [tokenParam]);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (!token) {
        setError('Invalid verification token.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const payload = await CredentialService.verifyQrPublic(token);
        if (!cancelled) {
          setResult(payload);
        }
      } catch (requestError: any) {
        if (!cancelled) {
          const message =
            requestError?.response?.data?.error ||
            requestError?.message ||
            'Unable to verify this QR token.';
          setError(message);
          setResult(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void verify();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <p className="inline-flex items-center gap-2 text-xl font-semibold text-slate-900">
            <ShieldCheck size={20} />
            Credential Verification
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Back
          </button>
        </div>

        {isLoading && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
            Verifying one-time QR token...
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            <p className="inline-flex items-center gap-2 font-semibold">
              <AlertCircle size={15} />
              Verification Failed
            </p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {!isLoading && !error && result && result.valid && result.credential && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-800">
              <p className="inline-flex items-center gap-2 font-semibold">
                <CheckCircle2 size={16} />
                Credential is valid
              </p>
              <p className="mt-1 text-sm">This one-time QR token was accepted and consumed.</p>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-sm">
              <p className="font-medium text-slate-500">Title</p>
              <p className="font-semibold text-slate-900">{result.credential.title}</p>
              <p className="font-medium text-slate-500">Type</p>
              <p className="font-semibold text-slate-900">{result.credential.type}</p>
              <p className="font-medium text-slate-500">Status</p>
              <p className="font-semibold text-slate-900">{result.credential.status}</p>
              <p className="font-medium text-slate-500">Institution</p>
              <p className="font-semibold text-slate-900">{result.credential.institutionName}</p>
              <p className="font-medium text-slate-500">Issued Date</p>
              <p className="font-semibold text-slate-900">
                {result.credential.issuedDate ? new Date(result.credential.issuedDate).toLocaleString() : '-'}
              </p>
              <p className="font-medium text-slate-500">Expiry Date</p>
              <p className="font-semibold text-slate-900">
                {result.credential.expiryDate ? new Date(result.credential.expiryDate).toLocaleString() : '-'}
              </p>
              <p className="font-medium text-slate-500">Blockchain</p>
              <p className="font-semibold text-slate-900">{result.credential.chain || 'Not anchored'}</p>
            </div>
          </div>
        )}

        {!isLoading && !error && result && !result.valid && (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-900">
              <p className="inline-flex items-center gap-2 font-semibold">
                {result.reason === 'EXPIRED' ? <Clock3 size={15} /> : <XCircle size={15} />}
                {result.reason === 'EXPIRED' ? 'Token Expired' : 'Token Invalid or Used'}
              </p>
              <p className="mt-1 text-sm">
                {result.reason === 'EXPIRED'
                  ? 'This one-time verification QR has expired. Ask the student to generate a new QR token.'
                  : 'This QR token is invalid or already consumed. Ask the student for a new QR token.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
