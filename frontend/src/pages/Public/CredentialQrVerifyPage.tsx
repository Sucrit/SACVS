import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock3, Download, Eye, ShieldCheck, XCircle } from 'lucide-react';
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

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

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

  return (
    <main className="credence-font min-h-screen bg-white px-4 py-8 sm:py-10">
      <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.10)]">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-2xl font-black tracking-tight">
                <ShieldCheck size={22} />
                Credential Verification
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Public one-time token validation for academic credentials.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
            >
              Back
            </button>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6 sm:px-8 sm:py-7">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            Token: <span className="font-mono text-slate-800">{token || '-'}</span>
          </div>

          {isLoading && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-5 w-52 rounded bg-slate-200" />
                <div className="h-4 w-full rounded bg-slate-200" />
                <div className="h-4 w-3/4 rounded bg-slate-200" />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-600">Verifying one-time QR token...</p>
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
              <p className="inline-flex items-center gap-2 text-base font-semibold">
                <AlertCircle size={16} />
                Verification Failed
              </p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {!isLoading && !error && result && result.valid && result.credential && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4 text-emerald-900">
                <p className="inline-flex items-center gap-2 text-lg font-bold">
                  <CheckCircle2 size={18} />
                  Credential is valid
                </p>
                <p className="mt-1 text-sm">This one-time QR token was accepted and consumed successfully.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Student Identity</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-500">Full Name</span>
                      <span className="text-right font-semibold text-slate-900">{result.credential.studentOwner}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-500">Student Number</span>
                      <span className="font-semibold text-slate-900">{result.credential.studentNumber || '-'}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-500">Email</span>
                      <span className="text-right font-semibold text-slate-900">{result.credential.studentEmail}</span>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Credential Details</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-500">Title</span>
                      <span className="text-right font-semibold text-slate-900">{result.credential.title}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-500">Type</span>
                      <span className="font-semibold text-slate-900">{result.credential.type}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-500">Status</span>
                      <span className="font-semibold text-slate-900">{result.credential.status}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-500">Institution</span>
                      <span className="text-right font-semibold text-slate-900">{result.credential.institutionName}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-500">Issued</span>
                      <span className="text-right font-semibold text-slate-900">{formatDateTime(result.credential.issuedDate)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-500">Expiry</span>
                      <span className="text-right font-semibold text-slate-900">{formatDateTime(result.credential.expiryDate)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-500">Blockchain</span>
                      <span className="font-semibold text-slate-900">{result.credential.chain || 'Not anchored'}</span>
                    </div>
                  </div>
                </section>
              </div>

              {result.documentAccess && (result.documentAccess.previewEnabled || result.documentAccess.downloadEnabled) && (
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Shared Document Access</p>
                  <p className="mt-1 text-sm text-slate-700">
                    Expires at <span className="font-semibold">{formatDateTime(result.documentAccess.expiresAt)}</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.documentAccess.previewEnabled && (
                      <button
                        type="button"
                        onClick={() => void handleOpenSharedDocument('preview')}
                        disabled={isLoadingDocument}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      >
                        <Eye size={13} />
                        {isLoadingDocument ? 'Opening...' : 'Preview Document'}
                      </button>
                    )}
                    {result.documentAccess.downloadEnabled && (
                      <button
                        type="button"
                        onClick={() => void handleOpenSharedDocument('download')}
                        disabled={isLoadingDocument}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      >
                        <Download size={13} />
                        {isLoadingDocument ? 'Preparing...' : 'Download Document'}
                      </button>
                    )}
                  </div>
                  {documentError && <p className="mt-2 text-xs font-semibold text-rose-700">{documentError}</p>}
                  {documentPreviewUrl && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <iframe src={documentPreviewUrl} title="Shared credential preview" className="h-[560px] w-full" />
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {!isLoading && !error && result && !result.valid && (
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 text-amber-900">
              <p className="inline-flex items-center gap-2 text-base font-semibold">
                {result.reason === 'EXPIRED' ? <Clock3 size={16} /> : <XCircle size={16} />}
                {result.reason === 'EXPIRED' ? 'Token Expired' : 'Token Invalid or Used'}
              </p>
              <p className="mt-1 text-sm">
                {result.reason === 'EXPIRED'
                  ? 'This one-time verification QR has expired. Ask the student to generate a new QR token.'
                  : 'This QR token is invalid or already consumed. Ask the student for a new QR token.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
