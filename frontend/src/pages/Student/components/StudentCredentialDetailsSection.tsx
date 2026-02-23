import { Download, Eye, Link2 } from 'lucide-react';
import Card from '../../../components/common/Card';
import { Credential } from '../../../services/credential.service';
import { formatDateTime, getCredentialFileUrl, shortenHash } from '../utils';

interface StudentCredentialDetailsSectionProps {
  selectedCredential: Credential | null;
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
}: StudentCredentialDetailsSectionProps) {
  const selectedCredentialFileUrl = getCredentialFileUrl(selectedCredential?.storageKey ?? null);
  const selectedCredentialHasImage = selectedCredential?.mimeType?.startsWith('image/') ?? false;

  if (!selectedCredential) {
    return (
      <Card title="Verification Trail">
        <p className="text-sm text-slate-500">Select a credential card to inspect verification details.</p>
      </Card>
    );
  }

  return (
    <Card title="Verification Trail">
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-900">{selectedCredential.title}</p>
          <p className="mt-1 text-xs text-slate-500">{selectedCredential.type}</p>
        </div>

        {selectedCredentialFileUrl && (
          <div className="space-y-3">
            {selectedCredentialHasImage ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <img
                  src={selectedCredentialFileUrl}
                  alt={selectedCredential.title}
                  className="h-52 w-full object-contain"
                />
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
            <p className="uppercase tracking-[0.08em] text-slate-400">File Name</p>
            <p className="mt-1 break-all text-sm font-semibold text-slate-800">{selectedCredential.filename || '-'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="uppercase tracking-[0.08em] text-slate-400">File Hash</p>
            <p className="mt-1 break-all text-sm font-semibold text-slate-800">{shortenHash(selectedCredential.fileHash)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

