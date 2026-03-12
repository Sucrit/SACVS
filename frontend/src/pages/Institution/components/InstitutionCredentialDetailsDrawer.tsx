import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Link2, X } from 'lucide-react';
import Badge from '../../../components/common/Badge';
import { useToast } from '../../../hooks/useToast';
import { Credential, CredentialService } from '../../../services/credential.service';
import { formatDateTime } from '../utils';

interface InstitutionCredentialDetailsDrawerProps {
  credentialId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onExited?: () => void;
}

const getInstitutionName = (credential: Credential | null) =>
  credential?.issuedBy?.institution?.institutionName ||
  [credential?.issuedBy?.firstName, credential?.issuedBy?.middleName, credential?.issuedBy?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() ||
  '--';

const getStudentName = (credential: Credential | null) =>
  [credential?.student?.firstName, credential?.student?.middleName, credential?.student?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() ||
  '--';

export default function InstitutionCredentialDetailsDrawer({
  credentialId,
  isOpen,
  onClose,
  onExited,
}: InstitutionCredentialDetailsDrawerProps) {
  const { showToast } = useToast();
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [documentBlob, setDocumentBlob] = useState<Blob | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);

  useEffect(() => {
    if (!credentialId) {
      setIsVisible(false);
      return;
    }

    if (isOpen) {
      setIsVisible(false);
      const frame = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setIsVisible(false);
    return;
  }, [credentialId, isOpen]);

  useEffect(() => {
    if (!isOpen || !credentialId) return;

    let isCancelled = false;
    setIsLoading(true);
    setCredential(null);
    setDocumentBlob(null);

    void CredentialService.getById(credentialId)
      .then(data => {
        if (!isCancelled) {
          setCredential(data);
        }
      })
      .catch(error => {
        if (!isCancelled) {
          showToast({
            variant: 'error',
            message: error instanceof Error ? error.message : 'Unable to load credential details.',
          });
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [credentialId, isOpen, showToast]);

  useEffect(() => {
    if (!isOpen || !credentialId || !credential || !credential.storageKey) return;

    let isCancelled = false;
    setIsLoadingDocument(true);
    setDocumentBlob(null);

    void CredentialService.getDocumentBlob(credentialId)
      .then(blob => {
        if (!isCancelled) {
          setDocumentBlob(blob);
        }
      })
      .catch(error => {
        if (!isCancelled) {
          showToast({
            variant: 'error',
            message: error instanceof Error ? error.message : 'Unable to load credential document.',
          });
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingDocument(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [credential, credentialId, isOpen, showToast]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen || !credentialId || !onExited) return;
    const timeout = window.setTimeout(() => {
      onExited();
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [credentialId, isOpen, onExited]);

  const previewUrl = useMemo(() => {
    if (!documentBlob) return null;
    return URL.createObjectURL(documentBlob);
  }, [documentBlob]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const mimeType = documentBlob?.type || credential?.mimeType || '';
  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';

  const handleDownload = () => {
    if (!documentBlob || !credential) return;
    const url = URL.createObjectURL(documentBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = credential.filename || `${credential.title || 'credential'}.bin`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleCopyTxHash = async () => {
    if (!credential?.txHash) return;
    try {
      await navigator.clipboard.writeText(credential.txHash);
      showToast({ variant: 'success', message: 'Transaction hash copied.' });
    } catch {
      showToast({ variant: 'error', message: 'Unable to copy transaction hash.' });
    }
  };

  if (!credentialId) {
    return null;
  }

  return (
    <div className={`fixed inset-0 z-[95] transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
      <button
        type="button"
        className={`absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px] transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-label="Close credential details"
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-2xl overflow-hidden border-l border-neutral-200 bg-white shadow-lg transition-transform duration-300 ease-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-3 sm:px-5 sm:py-4">
            <h3 className="text-lg font-semibold text-neutral-900">Credential Details</h3>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center text-neutral-500 transition-colors hover:text-neutral-900"
              aria-label="Close drawer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-3 sm:p-5">
            {isLoading && (
              <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
                <span
                  className="mb-4 inline-flex h-12 w-12 animate-spin rounded-full border-4 border-neutral-300 border-t-neutral-700"
                  aria-hidden="true"
                />
                <p className="text-lg font-semibold text-neutral-900">Loading credential details</p>
                <p className="mt-2 max-w-xl text-sm text-neutral-600">
                  Fetching document metadata, student context, and credential verification details.
                </p>
              </div>
            )}

            {!isLoading && credential && (
              <>
                <section className="pb-4">
                  <p className="text-xs font-semibold  text-neutral-500">Document Preview</p>
                  <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-2">
                    {credential.storageKey && isLoadingDocument && (
                      <div className="min-h-[240px] space-y-3 rounded-lg bg-neutral-50 p-4">
                        <div className="h-4 w-28 animate-pulse rounded bg-neutral-200" />
                        <div className="h-40 w-full animate-pulse rounded bg-neutral-200" />
                        <div className="h-4 w-40 animate-pulse rounded bg-neutral-200" />
                      </div>
                    )}
                    {!credential.storageKey && (
                      <div className="flex min-h-[240px] items-center justify-center text-sm text-neutral-500">
                        No file attached.
                      </div>
                    )}
                    {credential.storageKey && !documentBlob && !isLoadingDocument && (
                      <div className="flex min-h-[240px] items-center justify-center text-sm text-neutral-500">
                        No inline preview available.
                      </div>
                    )}
                    {previewUrl && isImage && (
                      <img src={previewUrl} alt={credential.title} className="max-h-[360px] w-full rounded-lg object-contain" />
                    )}
                    {previewUrl && isPdf && (
                      <iframe title="Credential PDF preview" src={previewUrl} className="h-[360px] w-full rounded-lg border-0" />
                    )}
                    {previewUrl && !isImage && !isPdf && (
                      <div className="flex min-h-[240px] items-center justify-center text-sm text-neutral-500">
                        No inline preview available.
                      </div>
                    )}
                  </div>
                </section>

                <section className="border-t border-neutral-200 pt-5">
                  <p className="text-xs font-semibold  text-neutral-500">Credential</p>
                  <h4 className="mt-2 text-xl font-semibold text-neutral-900">{credential.title}</h4>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-neutral-500">{credential.type}</span>
                    <Badge status={credential.status} />
                  </div>

                  <dl className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    <div>
                      <dt className="text-neutral-500">Student</dt>
                      <dd className="font-semibold text-neutral-900">{getStudentName(credential)}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Student Email</dt>
                      <dd className="font-semibold text-neutral-900">{credential.student?.email || '--'}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Student Number</dt>
                      <dd className="font-semibold text-neutral-900">{credential.student?.profile?.studentNumber || '--'}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Program</dt>
                      <dd className="font-semibold text-neutral-900">{credential.student?.profile?.courseOfStudy || '--'}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Institution</dt>
                      <dd className="font-semibold text-neutral-900">{getInstitutionName(credential)}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Issued Date</dt>
                      <dd className="font-semibold text-neutral-900">{formatDateTime(credential.issuedDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Expiry Date</dt>
                      <dd className="font-semibold text-neutral-900">{formatDateTime(credential.expiryDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">File Hash</dt>
                      <dd className="break-all font-semibold text-neutral-900">{credential.fileHash || '--'}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Chain</dt>
                      <dd className="font-semibold text-neutral-900">{credential.chain || '--'}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Block Number</dt>
                      <dd className="font-semibold text-neutral-900">
                        {typeof credential.blockNumber === 'number' ? credential.blockNumber : '--'}
                      </dd>
                    </div>
                    <div className="md:col-span-2">
                      <dt className="text-neutral-500">Transaction Hash</dt>
                      <dd className="flex items-center gap-2 break-all font-semibold text-neutral-900">
                        <span>{credential.txHash || '--'}</span>
                        {credential.txHash && (
                          <button
                            type="button"
                            onClick={handleCopyTxHash}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100"
                            title="Copy transaction hash"
                          >
                            <Link2 size={13} />
                          </button>
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>
              </>
            )}
          </div>

          <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-4 shrink-0">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
                >
                  <ExternalLink size={14} />
                  Preview
                </a>
              )}
              <button
                type="button"
                onClick={handleDownload}
                disabled={!documentBlob}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
              >
                <Download size={14} />
                Download
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
