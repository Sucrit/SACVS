import { useMemo, useState } from 'react';
import { ClipboardCheck, FileText, Upload } from 'lucide-react';
import Card from '../../../components/common/Card';
import ActionMenu from '../../../components/common/ActionMenu';
import Badge from '../../../components/common/Badge';
import RecordDetailsDrawer from '../../../components/common/RecordDetailsDrawer';
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

  return (
    <Card title="Awaiting Issuance">
      <div className="rounded-lg border border-neutral-200">
        <table className="w-full text-left">
          <thead className="bg-neutral-50 text-xs font-semibold text-neutral-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Request</th>
              <th className="hidden px-4 py-3 md:table-cell">Type</th>
              <th className="hidden px-4 py-3 lg:table-cell">Requested</th>
              <th className="hidden px-4 py-3 md:table-cell">Expiry Date</th>
              <th className="hidden px-4 py-3 lg:table-cell">File</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {isLoadingRequests && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-neutral-500">
                  Loading approved requests...
                </td>
              </tr>
            )}
            {!isLoadingRequests && readyToIssue.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-neutral-500">
                  No approved requests ready for issuance.
                </td>
              </tr>
            )}
            {!isLoadingRequests &&
              readyToIssue.map(request => (
                <tr key={request.id} className="hover:bg-neutral-50/70">
                  {(() => {
                    const requestCertificateCategory =
                      request.type === 'CERTIFICATE' ? getRequestCertificateCategory(request) : DEFAULT_CERTIFICATE_CATEGORY;
                    const requestRequiresExpiry = requiresExpiryDate(request.type, requestCertificateCategory);
                    return (
                      <>
                        <td className="px-4 py-3 text-sm text-neutral-700">
                          {(() => {
                            const student = studentById.get(request.studentId);
                            if (!student) return request.studentId;

                            return (
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-xs font-bold text-neutral-700">
                                  {getUserInitials(student)}
                                </div>
                                <div>
                                  <p className="font-semibold text-neutral-900">{getStudentFullName(student)}</p>
                                  <p className="mt-1 text-xs text-neutral-500">{student.email}</p>
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-neutral-900">{request.title}</p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {request.deliveryMethod === 'BOTH'
                              ? 'Digital + physical delivery'
                              : request.deliveryMethod === 'DIGITAL'
                                ? 'Digital delivery'
                                : 'Physical delivery'}
                          </p>
                        </td>
                        <td className="hidden px-4 py-3 text-sm text-neutral-600 md:table-cell">{getRequestTypeLabel(request)}</td>
                        <td className="hidden px-4 py-3 text-sm text-neutral-600 lg:table-cell">{formatDateTime(request.createdAt)}</td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          {supportsExpiryDate(request.type) ? (
                            <div className="space-y-1">
                              <p className="text-[10px] font-medium text-neutral-500">Expiry</p>
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
                            <span className="text-xs text-neutral-400">N/A</span>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 lg:table-cell">
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
                            <Upload size={12} />
                            {issueFileByRequestId[request.id]?.name || (request.credentialId ? 'Replace file' : 'Attach file')}
                          </label>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end">
                            <ActionMenu
                              items={[
                                {
                                  label: 'View details',
                                  icon: <FileText size={14} className="text-neutral-600" />,
                                  onClick: () => setSelectedRequestId(request.id),
                                },
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
    </Card>
  );
}
