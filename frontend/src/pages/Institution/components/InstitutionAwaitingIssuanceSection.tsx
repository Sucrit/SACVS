import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardCheck,
  Upload,
  User as UserIcon,
} from 'lucide-react';
import Card from '../../../components/common/Card';
import ActionMenu from '../../../components/common/ActionMenu';
import Badge from '../../../components/common/Badge';
import RecordDetailsDrawer from '../../../components/common/RecordDetailsDrawer';
import { detailField } from '../../../components/common/recordDetailsFieldIcons';
import Modal, { ModalFooter } from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { getUploadDropzoneClass, UPLOAD_DROPZONE_CTA_CLASS } from '../../../components/common/uploadSurface';
import {
  CredentialRequest,
  CredentialType,
} from '../../../services/credential.service';
import { User } from '../../../services/user.service';
import UserAvatar from '../../../components/common/UserAvatar';
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

  const renderAwaitingActions = (request: CredentialRequest, compact = false) => (
    <div className={`flex ${compact ? 'justify-start' : 'justify-end'} items-center gap-2`}>
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
  );

  return (
    <Card title="Awaiting Issuance">
      <div className="space-y-2 lg:hidden">
        {isLoadingRequests && (
          <div className="rounded-lg border border-neutral-200 bg-white px-5 py-8 text-center text-sm text-neutral-500">
            Loading approved requests...
          </div>
        )}
        {!isLoadingRequests && readyToIssue.length === 0 && (
          <div className="rounded-lg border border-neutral-200 bg-white px-5 py-8 text-center text-sm text-neutral-500">
            No approved requests ready for issuance.
          </div>
        )}
        {!isLoadingRequests && readyToIssue.map((request, index) => {
          const student = studentById.get(request.studentId);
          return (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
            >
              <button
                type="button"
                onClick={() => setSelectedRequestId(request.id)}
                className="w-full text-left"
              >
                <div className="flex items-start gap-3">
                  {student ? <UserAvatar initials={getUserInitials(student)} /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-neutral-900">
                      {student ? getStudentFullName(student) : request.studentId}
                    </p>
                    <p className="truncate text-xs text-neutral-500">{student?.email || 'Student record unavailable'}</p>
                  </div>
                </div>
              </button>
              <div className="mt-2.5 grid grid-cols-1 gap-1.5 text-[11px] text-neutral-600 sm:grid-cols-2">
                <div>
                  <p className="font-semibold uppercase tracking-[0.08em] text-neutral-500">Request Title</p>
                  <p className="mt-1 break-words">{request.title}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-[0.08em] text-neutral-500">Credential Type</p>
                  <p className="mt-1">{getRequestTypeLabel(request)}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-[0.08em] text-neutral-500">Delivery Method</p>
                  <p className="mt-1">
                    {request.deliveryMethod === 'BOTH'
                      ? 'Digital + physical'
                      : request.deliveryMethod === 'DIGITAL'
                        ? 'Digital'
                        : 'Physical'}
                  </p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-[0.08em] text-neutral-500">Requested At</p>
                  <p className="mt-1">{formatDateTime(request.createdAt)}</p>
                </div>
                <div className="sm:col-span-2" onClick={event => event.stopPropagation()}>
                  <p className="font-semibold uppercase tracking-[0.08em] text-neutral-500">Action</p>
                  <div className="mt-1">{renderAwaitingActions(request, true)}</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="hidden overflow-hidden rounded-lg border border-neutral-200 lg:block">
        <table className="min-w-[920px] w-full text-left">
          <thead className="bg-neutral-50 text-xs font-semibold text-neutral-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Request Title</th>
              <th className="hidden px-4 py-3 md:table-cell">Credential Type</th>
              <th className="hidden px-4 py-3 sm:table-cell">Delivery Method</th>
              <th className="hidden px-4 py-3 lg:table-cell">Requested At</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {isLoadingRequests && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-neutral-500">
                  Loading approved requests...
                </td>
              </tr>
            )}
            {!isLoadingRequests && readyToIssue.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-neutral-500">
                  No approved requests ready for issuance.
                </td>
              </tr>
            )}
             {!isLoadingRequests &&
              readyToIssue.map((request, index) => (
                <motion.tr
                  key={request.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="hover:bg-neutral-50/70"
                >
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
                                <UserAvatar initials={getUserInitials(student)} />
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
                          </button>
                        </td>
                        <td className="hidden px-4 py-3 text-sm text-neutral-600 md:table-cell">{getRequestTypeLabel(request)}</td>
                        <td className="hidden px-4 py-3 text-sm text-neutral-600 sm:table-cell">
                          <p className="text-sm text-neutral-500">
                            {request.deliveryMethod === 'BOTH'
                              ? 'Digital + physical'
                              : request.deliveryMethod === 'DIGITAL'
                                ? 'Digital'
                                : 'Physical'}
                          </p>
                        </td>
                        <td className="hidden px-4 py-3 text-sm text-neutral-600 lg:table-cell">{formatDateTime(request.createdAt)}</td>
                        <td className="px-4 py-3 text-right">{renderAwaitingActions(request)}</td>
                      </>
                    );
                  })()}
                </motion.tr>
              ))}
          </tbody>
        </table>
      </div>

      <RecordDetailsDrawer
        open={selectedRequest !== null}
        onClose={() => setSelectedRequestId(null)}
        title={selectedRequest?.title || 'Request Details'}
        description="Credential request information"
        sections={selectedRequest ? [
          {
            title: 'Student',
            fields: [
              detailField('Name', selectedRequestStudent ? getStudentFullName(selectedRequestStudent) : 'Student record unavailable', UserIcon),
              detailField('Student Number', selectedRequestStudent?.profile?.studentNumber || '--'),
              detailField('Email', selectedRequestStudent?.email || '--'),
              detailField('Program', selectedRequestStudent?.profile?.courseOfStudy || '--'),
            ],
          },
          {
            title: 'Request',
            fields: [
              detailField('Document', selectedRequest.title),
              detailField('Type', getRequestTypeLabel(selectedRequest)),
              detailField('Status', <Badge status={selectedRequest.status} />),
              detailField('Delivery', selectedRequest.deliveryMethod),
              detailField('Requested At', formatDateTime(selectedRequest.createdAt)),
              detailField('Processed At', selectedRequest.processedAt ? formatDateTime(selectedRequest.processedAt) : '--'),
              detailField('Purpose', selectedRequest.purpose || '--'),
              detailField('Description', selectedRequest.description || '--'),
              detailField('Notes', selectedRequest.notes || '--'),
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
        footer={
          issuingRequest ? (
            <ModalFooter
              leftActions={<Button variant="outline" onClick={() => setIssuingRequestId(null)}>Cancel</Button>}
              rightActions={
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
              }
            />
          ) : null
        }
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
                  getUploadDropzoneClass({
                    active: isFileDragOver && issuingRequest.deliveryMethod !== 'PHYSICAL',
                    disabled: issuingRequest.deliveryMethod === 'PHYSICAL',
                    className: 'flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition',
                  })
                }`}
                aria-disabled={issuingRequest.deliveryMethod === 'PHYSICAL'}
              >
                <Upload size={28} className="mb-3 text-neutral-400" />
                <p className="text-base text-neutral-700">
                  <span className={UPLOAD_DROPZONE_CTA_CLASS}>Upload a file</span> or drag and drop
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
          </div>
        )}
      </Modal>
    </Card>
  );
}

