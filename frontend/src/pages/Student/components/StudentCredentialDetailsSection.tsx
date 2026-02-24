import { Download, Eye, Link2, X } from 'lucide-react';
import { Credential } from '../../../services/credential.service';
import { formatDateTime, getCredentialFileUrl, shortenHash } from '../utils';

interface StudentCredentialDetailsSectionProps {
  selectedCredential: Credential | null;
  isOpen: boolean;
  onClose: () => void;
}

const copyText = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // Ignore clipboard failures silently for non-secure contexts.
  }
};

export default function StudentCredentialDetailsSection({
  selectedCredential,
  isOpen,
  onClose,
}: StudentCredentialDetailsSectionProps) {
  if (!isOpen) {
    return null;
  }

  const selectedCredentialFileUrl = getCredentialFileUrl(selectedCredential?.storageKey ?? null);
  const selectedCredentialHasImage = selectedCredential?.mimeType?.startsWith('image/') ?? false;

  if (!selectedCredential) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4" onClick={onClose}>
        <div
          className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          onClick={event => event.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-base font-semibold text-slate-900">Credential Details</p>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              aria-label="Close details modal"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-sm text-slate-500">Select a credential card to inspect details.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-slate-900">Credential Details</p>
            <p className="text-xs text-slate-500">Verification and file metadata</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Close details modal"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-900">{selectedCredential.title}</p>
            <p className="mt-1 text-xs text-slate-500">{selectedCredential.type}</p>
          </div>

          {selectedCredentialFileUrl && (
            <div className="space-y-3">
              {selectedCredentialHasImage ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <div className="flex min-h-[280px] max-h-[65vh] items-center justify-center overflow-hidden rounded-lg bg-white">
                    <img
                      src={selectedCredentialFileUrl}
                      alt={selectedCredential.title}
                      className="block h-auto max-h-[60vh] w-auto max-w-full object-contain"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-600">
                  Inline preview is not available for this file type.
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open(selectedCredentialFileUrl, '_blank', 'noopener,noreferrer')}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Eye size={13} />
                  View Full Document
                </button>
                <a
                  href={selectedCredentialFileUrl}
                  download={selectedCredential.filename || `${selectedCredential.title}.pdf`}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download size={13} />
                  Download
                </a>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="relative pl-6">
              <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-emerald-500"></span>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Issued</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(selectedCredential.issuedDate || selectedCredential.createdAt)}</p>
              <p className="text-xs text-slate-500">Issuer account: {selectedCredential.issuedById}</p>
            </div>

            <div className="relative pl-6">
              <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-sky-500"></span>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">AI Validation</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{selectedCredential.aiStatus || 'Not available'}</p>
              <p className="text-xs text-slate-500">Score: {selectedCredential.aiScore ?? '-'}</p>
            </div>

            <div className="relative pl-6">
              <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-indigo-500"></span>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Blockchain</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{selectedCredential.chain || 'Not anchored yet'}</p>
              <p className="text-xs text-slate-500">Block: {selectedCredential.blockNumber ?? '-'}</p>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                <code className="truncate font-mono text-slate-600">{shortenHash(selectedCredential.txHash)}</code>
                {selectedCredential.txHash && (
                  <button
                    onClick={() => void copyText(selectedCredential.txHash as string)}
                    className="text-slate-500 hover:text-slate-700"
                    title="Copy transaction hash"
                  >
                    <Link2 size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs text-slate-600">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="uppercase tracking-[0.08em] text-slate-400">Expiry Date</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{formatDateTime(selectedCredential.expiryDate)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="uppercase tracking-[0.08em] text-slate-400">File Hash</p>
              <p className="mt-1 break-all text-sm font-semibold text-slate-800">{shortenHash(selectedCredential.fileHash)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

