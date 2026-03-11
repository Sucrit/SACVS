import { useMemo, useState } from 'react';
import { Check, ClipboardCheck, FileText, Search, X, Upload } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import RecordDetailsDrawer from '../../../components/common/RecordDetailsDrawer';
import SearchFilterModal, { SearchFilterGroup } from '../../../components/common/SearchFilterModal';
import ActionMenu from '../../../components/common/ActionMenu';
import TopNavPortal from '../../../components/common/TopNavPortal';
import { CredentialRequest, CredentialType } from '../../../services/credential.service';
import { User } from '../../../services/user.service';
import { REQUEST_STATUS_OPTIONS, RequestStatusFilter } from '../types';
import { formatDate, getStudentFullName, getUserInitials } from '../utils';

interface InstitutionRequestsSectionProps {
  requests: CredentialRequest[];
  students: User[];
  isLoadingRequests: boolean;
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
  const studentById = useMemo(
    () => new Map(students.map(student => [student.id, student] as const)),
    [students],
  );
  const selectedRequest = useMemo(
    () => requests.find(request => request.id === selectedRequestId) || null,
    [requests, selectedRequestId],
  );
  const selectedRequestStudent = selectedRequest ? studentById.get(selectedRequest.studentId) || null : null;

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

  return (
    <div className="space-y-6">
      <TopNavPortal>
        <div className="flex w-full max-w-md items-center gap-2 justify-end">
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
      </TopNavPortal>

      <Card title="Student's Credential Requests">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button onClick={() => void onBulkAction('APPROVE')} className="inline-flex h-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">Bulk Approve</button>
              <button onClick={() => void onBulkAction('REJECT')} className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-800 hover:bg-rose-100">Bulk Reject</button>
            </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-left">
            <thead className="bg-neutral-50 text-xs font-semibold  text-neutral-500">
              <tr>
                <th className="px-4 py-3">Pick</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Document</th>
                <th className="hidden px-4 py-3 md:table-cell">Date</th>
                <th className="hidden px-4 py-3 lg:table-cell">Expiry Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="hidden px-4 py-3 lg:table-cell">Reason</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {isLoadingRequests && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-neutral-500">
                    Loading verification requests...
                  </td>
                </tr>
              )}
              {!isLoadingRequests && requests.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-neutral-500">
                    No requests available.
                  </td>
                </tr>
              )}
              {!isLoadingRequests && requests.map(request => (
                <tr key={request.id} className="hover:bg-neutral-50/70">
                  {(() => {
                    const requestCertificateCategory =
                      request.type === 'CERTIFICATE' ? getRequestCertificateCategory(request) : DEFAULT_CERTIFICATE_CATEGORY;
                    const requestRequiresExpiry = requiresExpiryDate(request.type, requestCertificateCategory);
                    return (
                      <>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRequestIds.includes(request.id)}
                      onChange={() => onToggleRequest(request.id)}
                      className="h-4 w-4 rounded border-neutral-300"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-700">
                    {(() => {
                      const student = studentById.get(request.studentId);
                      if (!student) {
                        return <span className="text-xs text-neutral-500">Student record unavailable</span>;
                      }

                      return (
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-xs font-bold text-neutral-700">
                            {getUserInitials(student)}
                          </div>
                          <div>
                            <p className="font-semibold text-neutral-900">{getStudentFullName(student)}</p>
                            <p className="mt-1 text-xs text-neutral-500">{student.profile?.studentNumber || student.email}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-700">
                      <FileText size={14} />
                      {getRequestTypeLabel(request)}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-neutral-600 md:table-cell">{formatDate(request.createdAt)}</td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {supportsExpiryDate(request.type) ? (
                      <div className="space-y-1">
                        <p className="text-[10px] font-medium  text-neutral-500">Expiry</p>
                        <input
                          type="date"
                          value={issueExpiryByRequestId[request.id] || ''}
                          onChange={event => onIssueExpiryChange(request.id, event.target.value)}
                          aria-label="Expiry Date"
                          className="h-9 rounded-lg border border-neutral-200 bg-neutral-50 px-2 text-xs outline-none"
                          required={requestRequiresExpiry}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400">Not applicable</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><Badge status={request.status} /></td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <input
                      value={rejectionReasonByRequestId[request.id] || ''}
                      onChange={event => onReasonChange(request.id, event.target.value)}
                      placeholder="Reason if rejecting..."
                      className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-xs outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {request.status === 'PENDING' ? (
                      <div className="flex items-center justify-end">
                        <ActionMenu
                          items={[
                            {
                              label: 'View details',
                              icon: <FileText size={14} className="text-neutral-600" />,
                              onClick: () => setSelectedRequestId(request.id),
                            },
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
                    ) : request.status === 'APPROVED' ? (
                      <div className="flex items-center justify-end gap-2">
                        <input
                          id={`file-upload-${request.id}`}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                          className="hidden"
                          disabled={request.deliveryMethod === 'PHYSICAL'}
                          onChange={event => onIssueFileChange(request.id, event.target.files?.[0] ?? null)}
                        />
                        {!issueFileByRequestId[request.id] && request.deliveryMethod !== 'PHYSICAL' && !request.credentialId && (
                          <label
                            htmlFor={`file-upload-${request.id}`}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] font-medium text-neutral-600 hover:bg-neutral-100"
                          >
                            <Upload size={12} />
                            Attach File
                          </label>
                        )}
                        {issueFileByRequestId[request.id] && (
                          <span className="text-[10px] text-neutral-500 max-w-[80px] truncate" title={issueFileByRequestId[request.id]?.name}>
                            {issueFileByRequestId[request.id]?.name}
                          </span>
                        )}
                        <ActionMenu
                          items={[
                            {
                              label: 'View details',
                              icon: <FileText size={14} className="text-neutral-600" />,
                              onClick: () => setSelectedRequestId(request.id),
                            },
                            ...((request.deliveryMethod !== 'PHYSICAL') ? [{
                              label: issueFileByRequestId[request.id] ? 'Change File' : 'Attach File',
                              icon: <Upload size={14} className="text-neutral-600" />,
                              onClick: () => {
                                const fileInput = document.getElementById(`file-upload-${request.id}`);
                                if (fileInput) fileInput.click();
                              },
                            }] : []),
                            {
                              label: 'Issue Credential',
                              icon: <ClipboardCheck size={14} className="text-cyan-700" />,
                              onClick: () => void onRequestAction(request.id, 'ISSUE'),
                              disabled: updatingRequestId === request.id ||
                                request.deliveryMethod === 'PHYSICAL' ||
                                (!request.credentialId && !issueFileByRequestId[request.id]) ||
                                (requestRequiresExpiry && !issueExpiryByRequestId[request.id]),
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
                    ) : (
                      <span className="text-xs text-neutral-500 px-2">Completed</span>
                    )}
                  </td>
                      </>
                    );
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

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
              { label: 'Requested At', value: formatDate(selectedRequest.createdAt) },
              { label: 'Processed At', value: selectedRequest.processedAt ? formatDate(selectedRequest.processedAt) : '--' },
              { label: 'Purpose', value: selectedRequest.purpose || '--' },
              { label: 'Description', value: selectedRequest.description || '--' },
              { label: 'Rejection Reason', value: selectedRequest.rejectionReason || '--' },
              { label: 'Notes', value: selectedRequest.notes || '--' },
            ],
          },
        ] : []}
      />
    </div>
  );
}
