import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ClipboardCheck, Search, Upload, X } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import RecordDetailsDrawer from '../../../components/common/RecordDetailsDrawer';
import SearchFilterModal, { SearchFilterGroup } from '../../../components/common/SearchFilterModal';
import ActionMenu from '../../../components/common/ActionMenu';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { getUploadDropzoneClass, UPLOAD_DROPZONE_CTA_CLASS } from '../../../components/common/uploadSurface';
import { CredentialRequest, CredentialType } from '../../../services/credential.service';
import { User } from '../../../services/user.service';
import UserAvatar from '../../../components/common/UserAvatar';
import { REQUEST_STATUS_OPTIONS, RequestStatusFilter } from '../types';
import { formatDate, getStudentFullName, getUserInitials } from '../utils';

interface InstitutionRequestsSectionProps {
  requests: CredentialRequest[];
  students: User[];
  isLoadingRequests: boolean;
  initialDetailsRequestId?: string | null;
  onDetailsRequestConsumed?: () => void;
  requestSearch: string;
  requestStatusFilter: RequestStatusFilter;
  selectedRequestIds: string[];
  rejectionReasonByRequestId: Record<string, string>;
  issueFileByRequestId: Record<string, File | null>;
  issueExpiryByRequestId: Record<string, string>;
  updatingRequestId: string | null;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: RequestStatusFilter) => void;
  onToggleRequest: (requestId: string) => void;
  onReasonChange: (requestId: string, reason: string) => void;
  onIssueFileChange: (requestId: string, file: File | null) => void;
  onIssueExpiryChange: (requestId: string, expiryDate: string) => void;
  onRequestAction: (
    requestId: string,
    action: 'APPROVE' | 'REJECT' | 'ISSUE' | 'MARK_PHYSICAL_CLAIMED',
  ) => Promise<void>;
  onBulkAction: (action: 'APPROVE' | 'REJECT') => Promise<void>;
}

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

export default function InstitutionRequestsSection({
  requests,
  students,
  isLoadingRequests,
  initialDetailsRequestId,
  onDetailsRequestConsumed,
  requestSearch,
  requestStatusFilter,
  selectedRequestIds,
  rejectionReasonByRequestId,
  issueFileByRequestId,
  issueExpiryByRequestId,
  updatingRequestId,
  onSearchChange,
  onFilterChange,
  onToggleRequest,
  onReasonChange,
  onIssueFileChange,
  onIssueExpiryChange,
  onRequestAction,
  onBulkAction,
}: InstitutionRequestsSectionProps) {
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [issuingRequestId, setIssuingRequestId] = useState<string | null>(null);
  const [isIssueFileDragOver, setIsIssueFileDragOver] = useState(false);
  const studentById = useMemo(
    () => new Map(students.map(student => [student.id, student] as const)),
    [students],
  );
  const selectedRequest = useMemo(
    () => requests.find(request => request.id === selectedRequestId) || null,
    [requests, selectedRequestId],
  );
  const selectedRequestStudent = selectedRequest ? studentById.get(selectedRequest.studentId) || null : null;
  const selectedRequestCertificateCategory = selectedRequest
    ? (selectedRequest.type === 'CERTIFICATE'
      ? getRequestCertificateCategory(selectedRequest)
      : DEFAULT_CERTIFICATE_CATEGORY)
    : DEFAULT_CERTIFICATE_CATEGORY;
  const selectedRequestRequiresExpiry = selectedRequest
    ? requiresExpiryDate(selectedRequest.type, selectedRequestCertificateCategory)
    : false;
  const issuingRequest = useMemo(
    () => requests.find(request => request.id === issuingRequestId) || null,
    [requests, issuingRequestId],
  );
  const issuingRequestCertificateCategory = issuingRequest
    ? (issuingRequest.type === 'CERTIFICATE' ? getRequestCertificateCategory(issuingRequest) : DEFAULT_CERTIFICATE_CATEGORY)
    : DEFAULT_CERTIFICATE_CATEGORY;
  const issuingRequestRequiresExpiry = issuingRequest
    ? requiresExpiryDate(issuingRequest.type, issuingRequestCertificateCategory)
    : false;

  useEffect(() => {
    if (!initialDetailsRequestId) return;
    setSelectedRequestId(initialDetailsRequestId);
    onDetailsRequestConsumed?.();
  }, [initialDetailsRequestId, onDetailsRequestConsumed]);

  const filterGroups = useMemo<SearchFilterGroup[]>(() => [
    {
      id: 'request-status',
      label: 'Status',
      value: requestStatusFilter,
      defaultValue: 'ALL',
      options: REQUEST_STATUS_OPTIONS.map(status => ({
        value: status,
        label: status === 'ALL' ? 'All statuses' : status,
      })),
      onChange: value => onFilterChange(value as RequestStatusFilter),
    },
  ], [onFilterChange, requestStatusFilter]);

  const renderRequestActions = (request: CredentialRequest, compact = false) => {
    if (request.status === 'PENDING') {
      return (
        <div className={`flex items-center ${compact ? 'justify-start' : 'justify-end'}`}>
          <ActionMenu
            items={[
              {
                label: 'Approve',
                icon: <Check size={14} className="text-emerald-600" />,
                onClick: () => void onRequestAction(request.id, 'APPROVE'),
                disabled: updatingRequestId === request.id,
              },
              {
                label: 'Reject',
                icon: <X size={14} className="text-rose-600" />,
                onClick: () => void onRequestAction(request.id, 'REJECT'),
                disabled: updatingRequestId === request.id,
                className: 'text-rose-700',
              }
            ]}
          />
        </div>
      );
    }

    if (request.status === 'APPROVED') {
      return (
        <div className={`flex items-center ${compact ? 'justify-start' : 'justify-end'} gap-2`}>
          <ActionMenu
            items={[
              {
                label: 'Issue Credential',
                icon: <ClipboardCheck size={14} className="text-cyan-700" />,
                onClick: () => setIssuingRequestId(request.id),
                disabled: updatingRequestId === request.id || request.deliveryMethod === 'PHYSICAL',
                className: 'text-cyan-800'
              },
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
    }

    return <span className="text-xs text-neutral-500">Completed</span>;
  };

  return (
    <div className="space-y-6">
      <Card title="Student's Credential Requests">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full max-w-xl items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={requestSearch}
                onChange={event => onSearchChange(event.target.value)}
                placeholder="Search request ID, student, title, type..."
                className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <SearchFilterModal
              hideLabel
              groups={filterGroups}
              description="Refine incoming requests by their current approval state."
            />
          </div>
          {selectedRequestIds.length >= 2 && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={<Check size={14} className="text-emerald-600" />}
                className="rounded-xl"
                onClick={() => void onBulkAction('APPROVE')}
              >
                Bulk Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<X size={14} className="text-rose-600" />}
                className="rounded-xl"
                onClick={() => void onBulkAction('REJECT')}
              >
                Bulk Reject
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2 lg:hidden">
          {isLoadingRequests && (
            <div className="rounded-lg border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">
              Loading verification requests...
            </div>
          )}
          {!isLoadingRequests && requests.length === 0 && (
            <div className="rounded-lg border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">
              No requests available.
            </div>
          )}
          {!isLoadingRequests && requests.map((request, index) => {
            const student = studentById.get(request.studentId);
            return (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
                onClick={() => setSelectedRequestId(request.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedRequestIds.includes(request.id)}
                      onChange={() => onToggleRequest(request.id)}
                      onClick={event => event.stopPropagation()}
                      className="mt-1 h-4 w-4 rounded border-neutral-300"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-900">
                        {student ? getStudentFullName(student) : 'Student record unavailable'}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {student?.profile?.studentNumber || student?.email || request.studentId}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0" onClick={event => event.stopPropagation()}>
                    <Badge status={request.status} />
                  </div>
                </div>
                <div className="mt-2.5 grid grid-cols-1 gap-1.5 text-[11px] text-neutral-600 sm:grid-cols-2">
                  <div>
                    <p className="font-semibold uppercase tracking-[0.08em] text-neutral-500">Document</p>
                    <p className="mt-1 break-words">{request.title}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-[0.08em] text-neutral-500">Type</p>
                    <p className="mt-1">{getRequestTypeLabel(request)}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-[0.08em] text-neutral-500">Date</p>
                    <p className="mt-1">{formatDate(request.createdAt)}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-[0.08em] text-neutral-500">Actions</p>
                    <div className="mt-1" onClick={event => event.stopPropagation()}>
                      {renderRequestActions(request, true)}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="hidden overflow-hidden rounded-lg border border-neutral-200 lg:block">
          <table className="w-full text-left">
            <thead className="bg-neutral-50 text-xs font-semibold  text-neutral-500">
              <tr>
                <th className="px-4 py-3">Pick</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Document</th>
                <th className="hidden px-4 py-3 md:table-cell">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {isLoadingRequests && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-neutral-500">
                    Loading verification requests...
                  </td>
                </tr>
              )}
              {!isLoadingRequests && requests.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-neutral-500">
                    No requests available.
                  </td>
                </tr>
              )}
               {!isLoadingRequests && requests.map((request, index) => (
                <motion.tr
                  key={request.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="cursor-pointer hover:bg-neutral-50/70"
                  onClick={() => setSelectedRequestId(request.id)}
                >
                  {(() => {
                    return (
                      <>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRequestIds.includes(request.id)}
                      onChange={() => onToggleRequest(request.id)}
                      onClick={event => event.stopPropagation()}
                      className="h-4 w-4 rounded border-neutral-300"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-700">
                    {(() => {
                      const student = studentById.get(request.studentId);
                      if (!student) {
                        return (
                          <div className="text-left text-xs font-medium text-neutral-500">
                            Student record unavailable
                          </div>
                        );
                      }

                      return (
                        <div className="flex w-full items-center gap-3 text-left">
                          <UserAvatar initials={getUserInitials(student)} />
                          <div>
                            <p className="font-semibold text-neutral-900">{getStudentFullName(student)}</p>
                            <p className="mt-1 text-xs text-neutral-500">{student.profile?.studentNumber || student.email}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
                      {getRequestTypeLabel(request)}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-neutral-600 md:table-cell">{formatDate(request.createdAt)}</td>
                  <td className="px-4 py-3"><Badge status={request.status} /></td>
                  <td className="px-4 py-3 text-right" onClick={event => event.stopPropagation()}>
                    {renderRequestActions(request)}
                  </td>
                      </>
                    );
                  })()}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={issuingRequest !== null}
        onClose={() => {
          setIssuingRequestId(null);
          setIsIssueFileDragOver(false);
        }}
        title="Issue Credential"
        description="Attach the required document and specify expiry details for the credential."
        size="md"
      >
        {issuingRequest && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="request-table-file-upload" className="text-sm font-semibold text-neutral-800">
                Document File
                {!issuingRequest.credentialId && <span className="ml-1 text-rose-500">*</span>}
              </label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => document.getElementById('request-table-file-upload')?.click()}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    document.getElementById('request-table-file-upload')?.click();
                  }
                }}
                onDragOver={event => {
                  event.preventDefault();
                  setIsIssueFileDragOver(true);
                }}
                onDragLeave={event => {
                  event.preventDefault();
                  setIsIssueFileDragOver(false);
                }}
                onDrop={event => {
                  event.preventDefault();
                  setIsIssueFileDragOver(false);
                  onIssueFileChange(issuingRequest.id, event.dataTransfer.files?.[0] ?? null);
                }}
                className={getUploadDropzoneClass({
                  active: isIssueFileDragOver,
                  className: 'flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition',
                })}
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
              </div>
              <input
                id="request-table-file-upload"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                className="hidden"
                onChange={event => onIssueFileChange(issuingRequest.id, event.target.files?.[0] ?? null)}
              />
            </div>
            {supportsExpiryDate(issuingRequest.type) && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="request-table-expiry-date" className="text-sm font-semibold text-neutral-800">
                  Expiry Date
                  {issuingRequestRequiresExpiry && <span className="ml-1 text-rose-500">*</span>}
                </label>
                <input
                  id="request-table-expiry-date"
                  type="date"
                  value={issueExpiryByRequestId[issuingRequest.id] || ''}
                  onChange={event => onIssueExpiryChange(issuingRequest.id, event.target.value)}
                  className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  required={issuingRequestRequiresExpiry}
                />
              </div>
            )}
            <div className="flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
              <Button variant="outline" onClick={() => { setIssuingRequestId(null); setIsIssueFileDragOver(false); }}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  void onRequestAction(issuingRequest.id, 'ISSUE').then(() => {
                    setIssuingRequestId(null);
                    setIsIssueFileDragOver(false);
                  })
                }
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

      <RecordDetailsDrawer
        open={selectedRequest !== null}
        onClose={() => setSelectedRequestId(null)}
        title={selectedRequest?.title || 'Request Details'}
        description="Credential request information"
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
              { label: 'Requested At', value: formatDate(selectedRequest.createdAt) },
              { label: 'Processed At', value: selectedRequest.processedAt ? formatDate(selectedRequest.processedAt) : '--' },
              { label: 'Purpose', value: selectedRequest.purpose || '--' },
              { label: 'Description', value: selectedRequest.description || '--' },
              { label: 'Notes', value: selectedRequest.notes || '--' },
            ],
          },
          {
            title: 'Processing',
            fields: [
              {
                label: 'Expiry Date',
                value: supportsExpiryDate(selectedRequest.type) ? (
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={issueExpiryByRequestId[selectedRequest.id] || ''}
                      onChange={event => onIssueExpiryChange(selectedRequest.id, event.target.value)}
                      aria-label="Expiry Date"
                      className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-xs outline-none"
                      required={selectedRequestRequiresExpiry}
                    />
                    <p className="text-[11px] text-neutral-500">
                      {selectedRequestRequiresExpiry ? 'Required before issuing this request.' : 'Optional for this request type.'}
                    </p>
                  </div>
                ) : 'Not applicable',
              },
              {
                label: 'Rejection Reason',
                value: (
                  <textarea
                    value={rejectionReasonByRequestId[selectedRequest.id] || ''}
                    onChange={event => onReasonChange(selectedRequest.id, event.target.value)}
                    placeholder="Reason if rejecting..."
                    rows={4}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs outline-none"
                  />
                ),
              },
            ],
          },
        ] : []}
      />
    </div>
  );
}

