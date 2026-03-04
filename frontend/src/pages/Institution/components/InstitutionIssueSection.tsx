import { FormEvent, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ClipboardCheck, Eye, Upload, X } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import ButtonLoadingContent from '../../../components/common/ButtonLoadingContent';
import { useToast } from '../../../hooks/useToast';
import {
  Credential,
  CredentialRequest,
  CredentialStatus,
  CredentialType,
} from '../../../services/credential.service';
import { User } from '../../../services/user.service';
import { formatDateTime, getStudentFullName } from '../utils';
import {
  MODAL_BACKDROP_VARIANTS,
  MODAL_PANEL_VARIANTS,
  MODAL_TRANSITION,
} from '../../../components/common/modal-motion';

const CREDENTIAL_TYPES: CredentialType[] = ['TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'];
const CREDENTIAL_STATUS_OPTIONS: Record<CredentialStatus, CredentialStatus[]> = {
  PENDING: ['PENDING', 'ISSUED', 'REVOKED'],
  ISSUED: ['ISSUED', 'REVOKED'],
  REVOKED: ['REVOKED'],
  EXPIRED: ['EXPIRED'],
};
const EXPIRY_ALLOWED_TYPES: CredentialType[] = ['CERTIFICATE', 'LICENSE'];
type CertificateCategory = 'ACADEMIC' | 'PROFESSIONAL';
const DEFAULT_CERTIFICATE_CATEGORY: CertificateCategory = 'ACADEMIC';
const CERTIFICATE_CATEGORIES: CertificateCategory[] = ['ACADEMIC', 'PROFESSIONAL'];
const OTP_BADGE_CLASS =
  'rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700';

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

interface InstitutionIssueSectionProps {
  students: User[];
  credentials: Credential[];
  isLoadingCredentials: boolean;
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
  onDirectIssue: (payload: {
    studentId: string;
    type: CredentialType;
    title: string;
    description?: string;
    expiryDate?: string;
    certificateCategory?: CertificateCategory;
    file: File;
  }) => Promise<Credential>;
  onCredentialStatusUpdate: (credentialId: string, status: CredentialStatus) => Promise<void>;
  onCredentialReissue: (credentialId: string, file?: File) => Promise<void>;
  onViewCredentialDetails: (credentialId: string) => void;
}

export default function InstitutionIssueSection({
  students,
  credentials,
  isLoadingCredentials,
  requests,
  isLoadingRequests,
  updatingRequestId,
  issueFileByRequestId,
  issueExpiryByRequestId,
  onIssueFileChange,
  onIssueExpiryChange,
  onRequestAction,
  onDirectIssue,
  onCredentialStatusUpdate,
  onCredentialReissue,
  onViewCredentialDetails,
}: InstitutionIssueSectionProps) {
  const { showToast } = useToast();
  const [directForm, setDirectForm] = useState({
    studentId: '',
    type: 'TRANSCRIPT' as CredentialType,
    title: '',
    description: '',
    expiryDate: '',
    certificateCategory: DEFAULT_CERTIFICATE_CATEGORY as CertificateCategory,
  });
  const [directFile, setDirectFile] = useState<File | null>(null);
  const [isDirectIssuing, setIsDirectIssuing] = useState(false);
  const [isDirectIssueModalOpen, setIsDirectIssueModalOpen] = useState(false);

  const [statusByCredentialId, setStatusByCredentialId] = useState<Record<string, CredentialStatus>>({});
  const [reissueFileByCredentialId, setReissueFileByCredentialId] = useState<Record<string, File | null>>({});
  const [updatingCredentialId, setUpdatingCredentialId] = useState<string | null>(null);
  const [reissuingCredentialId, setReissuingCredentialId] = useState<string | null>(null);

  const studentNameById = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach(student => {
      map.set(student.id, getStudentFullName(student) || student.email);
    });
    return map;
  }, [students]);

  const eligibleStudents = useMemo(
    () => students.filter(student => student.role === 'STUDENT'),
    [students],
  );

  const institutionCredentials = useMemo(
    () => [...credentials].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [credentials],
  );

  const readyToIssue = useMemo(
    () =>
      requests
        .filter(request => request.status === 'APPROVED')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [requests],
  );

  const handleSubmitDirectIssue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const studentId = directForm.studentId.trim();
    const title = directForm.title.trim();
    const description = directForm.description.trim();

    if (!studentId) {
      showToast({ variant: 'warning', message: 'Select a student.' });
      return;
    }
    if (!title) {
      showToast({ variant: 'warning', message: 'Title is required.' });
      return;
    }
    if (!directFile) {
      showToast({ variant: 'warning', message: 'Attach a credential file before issuing.' });
      return;
    }
    if (requiresExpiryDate(directForm.type, directForm.certificateCategory) && !directForm.expiryDate) {
      showToast({
        variant: 'warning',
        message: 'Expiry date is required for license and professional certificate credentials.',
      });
      return;
    }

    setIsDirectIssuing(true);
    try {
      await onDirectIssue({
        studentId,
        type: directForm.type,
        title,
        description: description || undefined,
        expiryDate: supportsExpiryDate(directForm.type) && directForm.expiryDate ? directForm.expiryDate : undefined,
        certificateCategory: directForm.type === 'CERTIFICATE' ? directForm.certificateCategory : undefined,
        file: directFile,
      });
      setDirectForm({
        studentId: '',
        type: 'TRANSCRIPT',
        title: '',
        description: '',
        expiryDate: '',
        certificateCategory: DEFAULT_CERTIFICATE_CATEGORY,
      });
      setDirectFile(null);
      setIsDirectIssueModalOpen(false);
      showToast({ variant: 'success', message: 'Credential issued successfully.' });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'STEP_UP_CANCELLED' || error.message === 'STEP_UP_IN_PROGRESS')
      ) {
        return;
      }
      const message = error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'Unable to issue credential directly.';
      showToast({ variant: 'error', message });
    } finally {
      setIsDirectIssuing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsDirectIssueModalOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          title="Issue credential directly via modal form"
        >
          <ClipboardCheck size={14} />
          Open Issuance Form
        </button>
      </div>

      <AnimatePresence>
        {isDirectIssueModalOpen && (
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={MODAL_BACKDROP_VARIANTS}
          transition={MODAL_TRANSITION}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[1px]"
          onClick={() => setIsDirectIssueModalOpen(false)}
        >
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={MODAL_PANEL_VARIANTS}
            transition={MODAL_TRANSITION}
            className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Direct Credential Issuance</h3>
              <button
                type="button"
                onClick={() => setIsDirectIssueModalOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center text-slate-500 transition-colors hover:text-slate-900"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            <form className="space-y-3" onSubmit={handleSubmitDirectIssue}>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <select
                  value={directForm.studentId}
                  onChange={event => setDirectForm(previous => ({ ...previous, studentId: event.target.value }))}
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
                  required
                >
                  <option value="">Select student</option>
                  {eligibleStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {(studentNameById.get(student.id) || student.email)} ({student.profile?.studentNumber || student.id})
                    </option>
                  ))}
                </select>
                <select
                  value={directForm.type}
                  onChange={event =>
                    setDirectForm(previous => {
                      const nextType = event.target.value as CredentialType;
                      return {
                        ...previous,
                        type: nextType,
                        expiryDate: supportsExpiryDate(nextType) ? previous.expiryDate : '',
                        certificateCategory: nextType === 'CERTIFICATE' ? previous.certificateCategory : DEFAULT_CERTIFICATE_CATEGORY,
                      };
                    })
                  }
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
                >
                  {CREDENTIAL_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <input
                  value={directForm.title}
                  onChange={event => setDirectForm(previous => ({ ...previous, title: event.target.value }))}
                  placeholder="Credential title (e.g. Bachelor of Science in IT)"
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
                  required
                />
                <input
                  value={directForm.description}
                  onChange={event => setDirectForm(previous => ({ ...previous, description: event.target.value }))}
                  placeholder="Description (optional)"
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
                />
                {directForm.type === 'CERTIFICATE' && (
                  <select
                    value={directForm.certificateCategory}
                    onChange={event =>
                      setDirectForm(previous => ({
                        ...previous,
                        certificateCategory: event.target.value as CertificateCategory,
                      }))
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
                  >
                    {CERTIFICATE_CATEGORIES.map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                )}
                {supportsExpiryDate(directForm.type) && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Expiry Date</p>
                    <input
                      type="date"
                      value={directForm.expiryDate}
                      onChange={event => setDirectForm(previous => ({ ...previous, expiryDate: event.target.value }))}
                      aria-label="Expiry Date"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
                      required={requiresExpiryDate(directForm.type, directForm.certificateCategory)}
                    />
                  </div>
                )}
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                  className="hidden"
                  onChange={event => setDirectFile(event.target.files?.[0] ?? null)}
                />
                <Upload size={12} />
                {directFile?.name || 'Attach credential file'}
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isDirectIssuing}
                  className="inline-flex h-10 items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-4 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50"
                  title="OTP required before this action is applied"
                >
                  <ClipboardCheck size={13} />
                  {isDirectIssuing ? <ButtonLoadingContent label="Issuing" /> : 'Issue Credential'}
                  {!isDirectIssuing && <span className={OTP_BADGE_CLASS}>OTP</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDirectIssueModalOpen(false)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <X size={14} />
                  Close
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <Card title="Issue From Approved Requests">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Expiry Date</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoadingRequests && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-500">
                    Loading approved requests...
                  </td>
                </tr>
              )}
              {!isLoadingRequests && readyToIssue.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-500">
                    No approved requests ready for issuance.
                  </td>
                </tr>
              )}
              {!isLoadingRequests &&
                readyToIssue.map(request => (
                  <tr key={request.id} className="hover:bg-slate-50/70">
                    {(() => {
                      const requestCertificateCategory =
                        request.type === 'CERTIFICATE' ? getRequestCertificateCategory(request) : DEFAULT_CERTIFICATE_CATEGORY;
                      const requestRequiresExpiry = requiresExpiryDate(request.type, requestCertificateCategory);
                      return (
                        <>
                    <td className="px-4 py-3 text-sm text-slate-700">{studentNameById.get(request.studentId) || request.studentId}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{request.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{request.id}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{getRequestTypeLabel(request)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(request.createdAt)}</td>
                    <td className="px-4 py-3">
                      {supportsExpiryDate(request.type) ? (
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">Expiry</p>
                          <input
                            type="date"
                            value={issueExpiryByRequestId[request.id] || ''}
                            onChange={event => onIssueExpiryChange(request.id, event.target.value)}
                            aria-label="Expiry Date"
                            className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs outline-none"
                            required={requestRequiresExpiry}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Not applicable</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <label
                        className={`inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ${
                          request.deliveryMethod === 'PHYSICAL'
                            ? 'cursor-not-allowed opacity-60'
                            : 'cursor-pointer hover:bg-slate-100'
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
                      <button
                        disabled={
                          updatingRequestId === request.id ||
                          request.deliveryMethod === 'PHYSICAL' ||
                          (!request.credentialId && !issueFileByRequestId[request.id]) ||
                          (requestRequiresExpiry && !issueExpiryByRequestId[request.id])
                        }
                        onClick={() => void onRequestAction(request.id, 'ISSUE')}
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50"
                        title={
                          request.deliveryMethod === 'PHYSICAL'
                            ? 'Digital issuance is blocked for PHYSICAL delivery requests.'
                            : !request.credentialId && !issueFileByRequestId[request.id]
                            ? 'Attach a file to issue this credential.'
                            : requestRequiresExpiry && !issueExpiryByRequestId[request.id]
                              ? 'Set an expiry date before issuing this credential.'
                              : 'Issue Credential (OTP required)'
                        }
                      >
                        <ClipboardCheck size={13} />
                        Issue
                        <span className={OTP_BADGE_CLASS}>OTP</span>
                      </button>
                      {(request.deliveryMethod === 'PHYSICAL' || request.deliveryMethod === 'BOTH') && (
                        <button
                        disabled={updatingRequestId === request.id || (request.deliveryMethod === 'BOTH' && !request.credentialId)}
                          onClick={() => void onRequestAction(request.id, 'MARK_PHYSICAL_CLAIMED')}
                          className="ml-2 inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                          title={
                            request.deliveryMethod === 'BOTH' && !request.credentialId
                              ? 'Issue/link the digital credential first for BOTH delivery.'
                              : 'Mark physical credential as claimed and complete the request.'
                          }
                        >
                          Mark Claimed
                        </button>
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

      <Card title="Manage Student Credentials">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Credential</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Update</th>
                <th className="px-4 py-3">Replace File</th>
                <th className="px-4 py-3 text-right">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoadingCredentials && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                    Loading institution credentials...
                  </td>
                </tr>
              )}
              {!isLoadingCredentials && institutionCredentials.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                    No credentials found for your institution.
                  </td>
                </tr>
              )}
              {!isLoadingCredentials &&
                institutionCredentials.map(credential => (
                  <tr key={credential.id} className="hover:bg-slate-50/70">
                    {(() => {
                      const isRevoked = credential.status === 'REVOKED';
                      const isExpired = credential.status === 'EXPIRED';
                      const isLockedForStatusUpdate = isRevoked || isExpired;
                      const allowedStatusOptions =
                        CREDENTIAL_STATUS_OPTIONS[credential.status] ?? [credential.status];
                      const targetStatus = statusByCredentialId[credential.id] || credential.status;
                      const isStatusUnchanged = targetStatus === credential.status;
                      return (
                        <>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {studentNameById.get(credential.studentId) || credential.studentId}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{credential.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{credential.type}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={credential.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(credential.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                          className="hidden"
                          onChange={event =>
                            setReissueFileByCredentialId(previous => ({
                              ...previous,
                              [credential.id]: event.target.files?.[0] ?? null,
                            }))
                          }
                        />
                        <Upload size={12} />
                        {reissueFileByCredentialId[credential.id]?.name || 'Upload'}
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={targetStatus}
                          onChange={event =>
                            setStatusByCredentialId(previous => ({
                              ...previous,
                              [credential.id]: event.target.value as CredentialStatus,
                            }))
                          }
                          disabled={isLockedForStatusUpdate}
                          className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {allowedStatusOptions.map(status => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => onViewCredentialDetails(credential.id)}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          title="View credential details"
                        >
                          <Eye size={12} />
                          View
                        </button>
                        <button
                          onClick={() => {
                            setUpdatingCredentialId(credential.id);
                            void onCredentialStatusUpdate(credential.id, targetStatus)
                              .catch(() => undefined)
                              .finally(() =>
                                setUpdatingCredentialId(current => (current === credential.id ? null : current)),
                              );
                          }}
                          disabled={updatingCredentialId === credential.id || isLockedForStatusUpdate || isStatusUnchanged}
                          className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setReissuingCredentialId(credential.id);
                            const file = reissueFileByCredentialId[credential.id] ?? undefined;
                            void onCredentialReissue(credential.id, file)
                              .then(() => {
                                setReissueFileByCredentialId(previous => {
                                  const next = { ...previous };
                                  delete next[credential.id];
                                  return next;
                                });
                              })
                              .catch(() => undefined)
                              .finally(() =>
                                setReissuingCredentialId(current => (current === credential.id ? null : current)),
                              );
                          }}
                          disabled={reissuingCredentialId === credential.id || isRevoked}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50"
                          title="OTP required before this action is applied"
                        >
                          <ClipboardCheck size={12} />
                          Re-issue
                          <span className={OTP_BADGE_CLASS}>OTP</span>
                        </button>
                        {isLockedForStatusUpdate && (
                          <span className="inline-flex h-9 items-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-700">
                            Locked
                          </span>
                        )}
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
      </Card>
    </div>
  );
}
