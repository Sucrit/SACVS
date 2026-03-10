import { useMemo } from 'react';
import { Check, ClipboardCheck, FileText, Search, X } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import SearchFilterModal, { SearchFilterGroup } from '../../../components/common/SearchFilterModal';
import { CredentialRequest, CredentialType } from '../../../services/credential.service';
import { User } from '../../../services/user.service';
import { REQUEST_STATUS_OPTIONS, RequestStatusFilter } from '../types';
import { formatDate } from '../utils';

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
  const studentById = new Map(
    students.map(student => [student.id, student] as const),
  );

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
      <Card title="Student's Credential Requests">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full items-center gap-2 lg:max-w-xl">
              <div className="relative flex-1">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  value={requestSearch}
                  onChange={event => onSearchChange(event.target.value)}
                  placeholder="Search request ID, student, title, type..."
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm outline-none"
                />
              </div>
              <SearchFilterModal
                groups={filterGroups}
                description="Refine incoming requests by their current approval state."
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button onClick={() => void onBulkAction('APPROVE')} className="inline-flex h-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">Bulk Approve</button>
              <button onClick={() => void onBulkAction('REJECT')} className="inline-flex h-10 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-800 hover:bg-rose-100">Bulk Reject</button>
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
                <th className="px-4 py-3 text-right">Actions</th>
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
                        return 'Student record unavailable';
                      }

                      const fullName = [student.firstName, student.middleName, student.lastName]
                        .filter(Boolean)
                        .join(' ');
                      const studentNumber = student.profile?.studentNumber || 'No student number';
                      return `${fullName} (${studentNumber})`;
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
                      <div className="inline-flex gap-2">
                        <button disabled={updatingRequestId === request.id} onClick={() => void onRequestAction(request.id, 'APPROVE')} className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50" title="Approve"><Check size={16} /></button>
                        <button disabled={updatingRequestId === request.id} onClick={() => void onRequestAction(request.id, 'REJECT')} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 disabled:opacity-50" title="Reject"><X size={16} /></button>
                      </div>
                    ) : request.status === 'APPROVED' ? (
                      <div className="inline-flex items-center justify-end gap-2">
                        <label
                          className={`inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-600 ${
                            request.deliveryMethod === 'PHYSICAL'
                              ? 'cursor-not-allowed opacity-60'
                              : 'cursor-pointer hover:bg-neutral-100'
                          }`}
                          title={
                            request.deliveryMethod === 'PHYSICAL'
                              ? 'Digital attachment is blocked for PHYSICAL delivery requests.'
                              : 'Attach file'
                          }
                        >
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                            className="hidden"
                            disabled={request.deliveryMethod === 'PHYSICAL'}
                            onChange={event => onIssueFileChange(request.id, event.target.files?.[0] ?? null)}
                          />
                          {issueFileByRequestId[request.id]?.name ? 'Change File' : 'Attach File'}
                        </label>
                        <button
                          disabled={
                            updatingRequestId === request.id ||
                            request.deliveryMethod === 'PHYSICAL' ||
                            (!request.credentialId && !issueFileByRequestId[request.id]) ||
                            (requestRequiresExpiry && !issueExpiryByRequestId[request.id])
                          }
                          onClick={() => void onRequestAction(request.id, 'ISSUE')}
                          className="rounded-lg border border-cyan-200 bg-cyan-50 p-2 text-cyan-700 hover:bg-cyan-100 disabled:opacity-50"
                          title={
                            request.deliveryMethod === 'PHYSICAL'
                              ? 'Digital issuance is blocked for PHYSICAL delivery requests.'
                              : !request.credentialId && !issueFileByRequestId[request.id]
                              ? 'Attach a file to issue this credential.'
                              : requestRequiresExpiry && !issueExpiryByRequestId[request.id]
                                ? 'Set an expiry date before issuing this credential.'
                                : 'Issue'
                          }
                        >
                          <ClipboardCheck size={16} />
                        </button>
                        {(request.deliveryMethod === 'PHYSICAL' || request.deliveryMethod === 'BOTH') && (
                          <button
                            disabled={
                              updatingRequestId === request.id ||
                              (request.deliveryMethod === 'BOTH' && !request.credentialId)
                            }
                            onClick={() => void onRequestAction(request.id, 'MARK_PHYSICAL_CLAIMED')}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                            title={
                              request.deliveryMethod === 'BOTH' && !request.credentialId
                                ? 'Issue/link the digital credential first for BOTH delivery.'
                                : 'Mark physical credential as claimed and complete the request.'
                            }
                          >
                            Mark Claimed
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-500">Completed</span>
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
    </div>
  );
}
