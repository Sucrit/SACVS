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
} from 'lucide-react';
import Card from '../../../components/common/Card';
import { Credential } from '../../../services/credential.service';
import { formatDateTime, getCredentialFileUrl, shortenHash } from '../utils';

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

export default function StudentCredentialDetailsSection({
  selectedCredential,
  onBack,
}: StudentCredentialDetailsSectionProps) {
  const selectedCredentialFileUrl = getCredentialFileUrl(selectedCredential?.storageKey ?? null);
  const selectedCredentialHasImage = selectedCredential?.mimeType?.startsWith('image/') ?? false;
  const isRevoked = selectedCredential?.status === 'REVOKED';
  const issuerInstitutionName =
    selectedCredential?.issuedBy?.institution?.institutionName?.trim() || 'Your institution';

  const handleShare = async () => {
    if (!selectedCredential || !selectedCredentialFileUrl) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: selectedCredential.title,
          text: `Credential: ${selectedCredential.title}`,
          url: selectedCredentialFileUrl,
        });
        return;
      } catch {
        // Fall back to copy link if share dialog is unavailable/cancelled.
      }
    }

    await copyText(selectedCredentialFileUrl);
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
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <ArrowLeft size={14} />
        Back
      </button>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
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
              <FileBadge2 size={14} className="text-slate-500" />
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Document Preview</p>
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
                No file is attached to this credential.
              </div>
            )}

            {selectedCredentialFileUrl && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleShare()}
                  disabled={isRevoked}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Share2 size={13} />
                  Share
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
                AI Status
              </p>
              <p className="font-semibold text-slate-900">
                {selectedCredential.aiStatus || 'Not available'}
                <span className="ml-2 text-xs font-normal text-slate-500">Score: {selectedCredential.aiScore ?? '-'}</span>
              </p>

              <p className="inline-flex items-center gap-2 font-medium text-slate-500">
                <Link2 size={14} />
                Blockchain
              </p>
              <div>
                <p className="font-semibold text-slate-900">{selectedCredential.chain || 'Not anchored yet'}</p>
                <p className="mt-1 text-xs text-slate-500">Block: {selectedCredential.blockNumber ?? '-'}</p>
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
            </div>
          </section>
      </div>
    </Card>
  );
}

