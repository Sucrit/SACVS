import { useMemo, useState } from 'react';
import { ClipboardCheck, Upload } from 'lucide-react';
import Card from '../../../components/common/Card';
import ActionMenu from '../../../components/common/ActionMenu';
import Badge from '../../../components/common/Badge';
import RecordDetailsDrawer from '../../../components/common/RecordDetailsDrawer';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import {
  CredentialRequest,
  CredentialType,
} from '../../../services/credential.service';
import { User } from '../../../services/user.service';
import { formatDateTime, getStudentFullName, getUserInitials } from '../utils';

const EXPIRY_ALLOWED_TYPES: CredentialType[] = ['CERTIFICATE', 'LICENSE'];
type CertificateCategory = 'ACADEMIC' | 'PROFESSIONAL';
const DEFAULT_CERTIFICATE_CATEGORY: CertificateCategory = 'ACADEMIC';

const supportsExpiryDate = (type: CredentialType) => EXPIRY_ALLOWED_TYPES.includes(type);
const requiresExpiryDate = (
  type: CredentialType,
  certificateCategory: CertificateCategory = DEFAULT_CERTIFICATE_CATEGORY,
) => type === 'LICENSE' || (type === 'CERTIFICATE' && certificateCategory === 'PROFESSIONAL');

const getRequestCertificateCategory = (request: CredentialRequest): CertificateCategory => {
  const value = request.metadata && typeof request.metadata === 'object'
    ? (request.metadata as Record<string, unknown>).certificateCategory
    : undefined;
  return value === 'PROFESSIONAL' ? 'PROFESSIONAL' : DEFAULT_CERTIFICATE_CATEGORY;
};

const getRequestTypeLabel = (request: CredentialRequest): string => {
  if (request.type !== 'CERTIFICATE') return request.type;
  return `CERTIFICATE (${getRequestCertificateCategory(request)})`;
};

interface InstitutionAwaitingIssuanceSectionProps {
  students: User[];
  requests: CredentialRequest[];
  isLoadingRequests: boolean;
  updatingRequestId: string | null;
  issueFileByRequestId: Record<string, File | null>;
  issueExpiryByRequestId: Record<string, string>;
  onIssueFileChange: (requestId: string, file: File | null) => void;
  onIssueExpiryChange: (requestId: string, expiryDate: string) => void;
  onRequestAction: (
    requestId: string,
    action: 'APPROVE' | 'REJECT' | 'ISSUE' | 'MARK_PHYSICAL_CLAIMED',
  ) => Promise<void>;
}

export default function InstitutionAwaitingIssuanceSection({
  students,
  requests,
  isLoadingRequests,
  updatingRequestId,
  issueFileByRequestId,
  issueExpiryByRequestId,
  onIssueFileChange,
  onIssueExpiryChange,
  onRequestAction,
}: InstitutionAwaitingIssuanceSectionProps) {
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [issuingRequestId, setIssuingRequestId] = useState<string | null>(null);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const studentById = useMemo(
    () => new Map(students.map(student => [student.id, student] as const)),
    [students],
  );

  const readyToIssue = useMemo(
    () =>
      requests
        .filter(request => request.status === 'APPROVED')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [requests],
  );
  const selectedRequest = useMemo(
    () => readyToIssue.find(request => request.id === selectedRequestId) || null,
    [readyToIssue, selectedRequestId],
  );
  const selectedRequestStudent = selectedRequest ? studentById.get(selectedRequest.studentId) || null : null;

  const issuingRequest = useMemo(
    () => readyToIssue.find(request => request.id === issuingRequestId) || null,
    [readyToIssue, issuingRequestId],
  );
  const issuingRequestCertificateCategory = issuingRequest?.type === 'CERTIFICATE' ? getRequestCertificateCategory(issuingRequest) : DEFAULT_CERTIFICATE_CATEGORY;
  const issuingRequestRequiresExpiry = issuingRequest ? requiresExpiryDate(issuingRequest.type, issuingRequestCertificateCategory) : false;

  const handleConfirmIssue = async () => {
    if (!issuingRequestId) return;
    await onRequestAction(issuingRequestId, 'ISSUE');
    setIssuingRequestId(null);
  };

  return (
    <Card title="Awaiting Issuance">
      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-[920px] w-full text-left">
          <thead className="bg-neutral-50 text-xs font-semibold text-neutral-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Request</th>
              <th className="hidden px-4 py-3 md:table-cell">Type</th>
              <th className="hidden px-4 py-3 lg:table-cell">Requested</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {isLoadingRequests && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-neutral-500">
                  Loading approved requests...
                </td>
              </tr>
            )}
            {!isLoadingRequests && readyToIssue.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-neutral-500">
                  No approved requests ready for issuance.
                </td>
              </tr>
            )}
            {!isLoadingRequests &&
              readyToIssue.map(request => (
                <tr key={request.id} className="hover:bg-neutral-50/70">
                  {(() => {
                    return (
                      <>
                        <td className="px-4 py-3 text-sm text-neutral-700">
                          {(() => {
                            const student = studentById.get(request.studentId);
                            if (!student) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => setSelectedRequestId(request.id)}
                                  className="text-left text-xs font-medium text-neutral-500 transition hover:text-neutral-700"
                                >
                                  {request.studentId}
                                </button>
                              );
                            }

                            return (
                              <button
                                type="button"
                                onClick={() => setSelectedRequestId(request.id)}
                                className="flex w-full items-center gap-3 text-left transition hover:opacity-80"
                              >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-xs font-bold text-neutral-700">
                                  {getUserInitials(student)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-neutral-900">{getStudentFullName(student)}</p>
                                  <p className="mt-1 truncate text-xs text-neutral-500">{student.email}</p>
                                </div>
                              </button>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedRequestId(request.id)}
                            className="w-full text-left transition hover:opacity-80"
                          >
                            <p className="text-sm font-semibold text-neutral-900">{request.title}</p>
                            <p className="mt-1 text-xs text-neutral-500">
                              {request.deliveryMethod === 'BOTH'
                                ? 'Digital + physical delivery'
                                : request.deliveryMethod === 'DIGITAL'
                                  ? 'Digital delivery'
                                  : 'Physical delivery'}
                            </p>
                          </button>
                        </td>
                        <td className="hidden px-4 py-3 text-sm text-neutral-600 md:table-cell">{getRequestTypeLabel(request)}</td>
                        <td className="hidden px-4 py-3 text-sm text-neutral-600 lg:table-cell">{formatDateTime(request.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex min-w-[240px] flex-col items-end gap-2 whitespace-nowrap">
                            <ActionMenu
                              items={[
                                ...((request.deliveryMethod !== 'PHYSICAL') ? [{
                                  label: 'Issue Credential',
                                  icon: <ClipboardCheck size={14} className="text-cyan-700" />,
                                  onClick: () => setIssuingRequestId(request.id),
                                  disabled: updatingRequestId === request.id,
                                  className: 'text-cyan-800'
                                }] : []),
                                ...((request.deliveryMethod === 'PHYSICAL' || request.deliveryMethod === 'BOTH') ? [{
                                  label: 'Mark Claimed',
                                  icon: <ClipboardCheck size={14} className="text-amber-700" />,
                                  onClick: () => void onRequestAction(request.id, 'MARK_PHYSICAL_CLAIMED'),
                                  disabled: updatingRequestId === request.id || (request.deliveryMethod === 'BOTH' && !request.credentialId),
                                  className: 'text-amber-800'
                                }] : [])
                              ]}
                            />
                          </div>
                        </td>
                      </>
                    );
                  })()}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <RecordDetailsDrawer
        open={selectedRequest !== null}
        onClose={() => setSelectedRequestId(null)}
        title={selectedRequest?.title || 'Request Details'}
        description="Detailed request information"
        sections={selectedRequest ? [
          {
            title: 'Student',
            fields: [
              {
                label: 'Name',
                value: selectedRequestStudent ? getStudentFullName(selectedRequestStudent) : 'Student record unavailable',
              },
              {
                label: 'Student Number',
                value: selectedRequestStudent?.profile?.studentNumber || '--',
              },
              {
                label: 'Email',
                value: selectedRequestStudent?.email || '--',
              },
              {
                label: 'Program',
                value: selectedRequestStudent?.profile?.courseOfStudy || '--',
              },
            ],
          },
          {
            title: 'Request',
            fields: [
              { label: 'Document', value: selectedRequest.title },
              { label: 'Type', value: getRequestTypeLabel(selectedRequest) },
              { label: 'Status', value: <Badge status={selectedRequest.status} /> },
              { label: 'Delivery', value: selectedRequest.deliveryMethod },
              { label: 'Requested At', value: formatDateTime(selectedRequest.createdAt) },
              { label: 'Processed At', value: selectedRequest.processedAt ? formatDateTime(selectedRequest.processedAt) : '--' },
              { label: 'Purpose', value: selectedRequest.purpose || '--' },
              { label: 'Description', value: selectedRequest.description || '--' },
              { label: 'Notes', value: selectedRequest.notes || '--' },
            ],
          },
        ] : []}
      />

      <Modal
        open={issuingRequestId !== null}
        onClose={() => setIssuingRequestId(null)}
        title="Issue Credential"
        description="Attach the required document and specify expiry details for the credential."
        size="md"
      >
        {issuingRequest && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="modal-file-upload" className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                Document File
                {!issuingRequest.credentialId && <span className="text-rose-500">*</span>}
              </label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  const fileInput = document.getElementById('modal-file-upload');
                  if (fileInput) fileInput.click();
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    const fileInput = document.getElementById('modal-file-upload');
                    if (fileInput) fileInput.click();
                  }
                }}
                onDragOver={event => {
                  event.preventDefault();
                  if (issuingRequest.deliveryMethod !== 'PHYSICAL') {
                    setIsFileDragOver(true);
                  }
                }}
                onDragLeave={event => {
                  event.preventDefault();
                  setIsFileDragOver(false);
                }}
                onDrop={event => {
                  event.preventDefault();
                  setIsFileDragOver(false);
                  if (issuingRequest.deliveryMethod === 'PHYSICAL') return;
                  const file = event.dataTransfer.files?.[0] ?? null;
                  onIssueFileChange(issuingRequest.id, file);
                }}
                className={`flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition ${
                  issuingRequest.deliveryMethod === 'PHYSICAL'
                    ? 'cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-400'
                    : isFileDragOver
                      ? 'border-cyan-400 bg-cyan-50/60 text-cyan-700'
                      : 'border-neutral-300 bg-neutral-50 hover:border-cyan-300 hover:bg-cyan-50/40'
                }`}
                aria-disabled={issuingRequest.deliveryMethod === 'PHYSICAL'}
              >
                <Upload size={28} className="mb-3 text-neutral-400" />
                <p className="text-base text-neutral-700">
                  <span className="font-semibold text-cyan-700">Upload a file</span> or drag and drop
                </p>
                <p className="mt-2 text-sm text-neutral-500">PDF, PNG, JPG up to 10MB</p>
                {issueFileByRequestId[issuingRequest.id] && (
                  <p className="mt-4 max-w-full truncate rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm font-medium text-neutral-700" title={issueFileByRequestId[issuingRequest.id]?.name || undefined}>
                    {issueFileByRequestId[issuingRequest.id]?.name}
                  </p>
                )}
                {issuingRequest.deliveryMethod === 'PHYSICAL' && (
                  <p className="mt-3 text-xs text-neutral-400">Digital attachment is blocked for PHYSICAL delivery requests.</p>
                )}
              </div>
              <input
                type="file"
                id="modal-file-upload"
                accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                className="hidden"
                disabled={issuingRequest.deliveryMethod === 'PHYSICAL'}
                onChange={event => onIssueFileChange(issuingRequest.id, event.target.files?.[0] ?? null)}
              />
            </div>

            {supportsExpiryDate(issuingRequest.type) && (
              <div className="flex flex-col gap-1.5 mt-2">
                <label htmlFor="modal-expiry-date" className="font-semibold text-neutral-800 text-sm">
                  Expiry Date
                  {issuingRequestRequiresExpiry && <span className="text-rose-500 ml-1">*</span>}
                </label>
                <input
                  type="date"
                  id="modal-expiry-date"
                  value={issueExpiryByRequestId[issuingRequest.id] || ''}
                  onChange={event => onIssueExpiryChange(issuingRequest.id, event.target.value)}
                  className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  required={issuingRequestRequiresExpiry}
                />
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
              <Button variant="outline" onClick={() => setIssuingRequestId(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmIssue}
                disabled={
                  updatingRequestId === issuingRequest.id ||
                  (!issuingRequest.credentialId && !issueFileByRequestId[issuingRequest.id]) ||
                  (issuingRequestRequiresExpiry && !issueExpiryByRequestId[issuingRequest.id])
                }
                loading={updatingRequestId === issuingRequest.id}
              >
                Confirm & Issue
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
