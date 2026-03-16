import { FormEvent, useMemo, useState } from 'react';
import UserAvatar from '../../../components/common/UserAvatar';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ClipboardCheck, Upload, X } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import RecordDetailsDrawer from '../../../components/common/RecordDetailsDrawer';
import Button from '../../../components/ui/Button';
import { getUploadDropzoneClass, UPLOAD_DROPZONE_CTA_CLASS } from '../../../components/common/uploadSurface';
import { useToast } from '../../../hooks/useToast';
import {
  Credential,
  CredentialRequest,
  CredentialStatus,
  CredentialType,
} from '../../../services/credential.service';
import { User } from '../../../services/user.service';
import { formatDateTime, getStudentFullName, getUserInitials } from '../utils';
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
const DIRECT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const DIRECT_UPLOAD_ACCEPTED_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg']);

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
  onCredentialReissue
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
  const [isDirectFileDragActive, setIsDirectFileDragActive] = useState(false);
  const [isDirectIssuing, setIsDirectIssuing] = useState(false);
  const [isDirectIssueModalOpen, setIsDirectIssueModalOpen] = useState(false);

  const [statusByCredentialId, setStatusByCredentialId] = useState<Record<string, CredentialStatus>>({});
  const [reissueFileByCredentialId, setReissueFileByCredentialId] = useState<Record<string, File | null>>({});
  const [updatingCredentialId, setUpdatingCredentialId] = useState<string | null>(null);
  const [reissuingCredentialId, setReissuingCredentialId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [issuingRequestId, setIssuingRequestId] = useState<string | null>(null);
  const [isIssueFileDragActive, setIsIssueFileDragActive] = useState(false);
  const [reissueModalCredentialId, setReissueModalCredentialId] = useState<string | null>(null);
  const [isReissueFileDragActive, setIsReissueFileDragActive] = useState(false);

  const studentById = useMemo(
    () => new Map(students.map(student => [student.id, student] as const)),
    [students],
  );

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
  const reissueCredential = useMemo(
    () => institutionCredentials.find(credential => credential.id === reissueModalCredentialId) || null,
    [institutionCredentials, reissueModalCredentialId],
  );
  const modalRoot = typeof document !== 'undefined' ? document.body : null;

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

  const handleDirectFileSelection = (file: File | null) => {
    if (!file) {
      setDirectFile(null);
      return;
    }

    if (!DIRECT_UPLOAD_ACCEPTED_MIME.has(file.type)) {
      showToast({
        variant: 'warning',
        message: 'Unsupported file type. Please upload PDF, PNG, or JPG.',
      });
      return;
    }

    if (file.size > DIRECT_UPLOAD_MAX_BYTES) {
      showToast({
        variant: 'warning',
        message: 'File is too large. Maximum file size is 10MB.',
      });
      return;
    }

    setDirectFile(file);
  };

  const handleConfirmRequestIssue = async () => {
    if (!issuingRequest) return;
    await onRequestAction(issuingRequest.id, 'ISSUE');
    setIssuingRequestId(null);
    setIsIssueFileDragActive(false);
  };

  const handleConfirmCredentialReissue = async () => {
    if (!reissueCredential) return;
    const file = reissueFileByCredentialId[reissueCredential.id] ?? undefined;
    await onCredentialReissue(reissueCredential.id, file);
    setReissueFileByCredentialId(previous => {
      const next = { ...previous };
      delete next[reissueCredential.id];
      return next;
    });
    setReissueModalCredentialId(null);
    setIsReissueFileDragActive(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsDirectIssueModalOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm font-semibold text-neutral-700 hover:bg-SLATE-700-TEST-MARKER"
          title="Issue credential directly via modal form"
        >
          <ClipboardCheck size={14} />
          Open Issuance Form
        </button>
      </div>

      {modalRoot && createPortal(
      <AnimatePresence>
        {isDirectIssueModalOpen ? (
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={MODAL_BACKDROP_VARIANTS}
          transition={MODAL_TRANSITION}
          className="fixed inset-0 z-90 flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-[1px]"
          onClick={() => setIsDirectIssueModalOpen(false)}
        >
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={MODAL_PANEL_VARIANTS}
            transition={MODAL_TRANSITION}
            className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Direct Credential Issuance</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Issue a credential directly to a selected student account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDirectIssueModalOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center text-neutral-500 transition-colors hover:text-neutral-900"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            <form className="space-y-3 p-5" onSubmit={handleSubmitDirectIssue}>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-neutral-500">Student <span className="text-rose-500">*</span></span>
                  <select
                    value={directForm.studentId}
                    onChange={event => setDirectForm(previous => ({ ...previous, studentId: event.target.value }))}
                    className="h-11 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none"
                    required
                  >
                    <option value="">Select student</option>
                    {eligibleStudents.map(student => (
                      <option key={student.id} value={student.id}>
                        {(getStudentFullName(student) || student.email)} ({student.profile?.studentNumber || student.id})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-neutral-500">Credential Type</span>
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
                    className="h-11 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none"
                  >
                    {CREDENTIAL_TYPES.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-neutral-500">Credential Title <span className="text-rose-500">*</span></span>
                  <input
                    value={directForm.title}
                    onChange={event => setDirectForm(previous => ({ ...previous, title: event.target.value }))}
                    placeholder="Credential title (e.g. Bachelor of Science in IT)"
                    className="h-11 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none"
                    required
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-neutral-500">Description</span>
                  <input
                    value={directForm.description}
                    onChange={event => setDirectForm(previous => ({ ...previous, description: event.target.value }))}
                    placeholder="Description (optional)"
                    className="h-11 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none"
                  />
                </label>
                {directForm.type === 'CERTIFICATE' && (
                  <label className="space-y-1.5">
                    <span className="block text-xs font-semibold text-neutral-500">Certificate Category</span>
                    <select
                      value={directForm.certificateCategory}
                      onChange={event =>
                        setDirectForm(previous => ({
                          ...previous,
                          certificateCategory: event.target.value as CertificateCategory,
                        }))
                      }
                      className="h-11 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none"
                    >
                      {CERTIFICATE_CATEGORIES.map(category => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {supportsExpiryDate(directForm.type) && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-neutral-500">
                      Expiry Date
                      {requiresExpiryDate(directForm.type, directForm.certificateCategory) && <span className="ml-1 text-rose-500">*</span>}
                    </p>
                    <input
                      type="date"
                      value={directForm.expiryDate}
                      onChange={event => setDirectForm(previous => ({ ...previous, expiryDate: event.target.value }))}
                      aria-label="Expiry Date"
                      className="h-11 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none"
                      required={requiresExpiryDate(directForm.type, directForm.certificateCategory)}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-neutral-800">Student Credential Document <span className="text-rose-500">*</span></p>
                <label
                  className={getUploadDropzoneClass({
                    active: isDirectFileDragActive,
                    className: 'flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center transition-colors',
                  })}
                  onDragOver={event => {
                    event.preventDefault();
                    setIsDirectFileDragActive(true);
                  }}
                  onDragEnter={event => {
                    event.preventDefault();
                    setIsDirectFileDragActive(true);
                  }}
                  onDragLeave={event => {
                    event.preventDefault();
                    setIsDirectFileDragActive(false);
                  }}
                  onDrop={event => {
                    event.preventDefault();
                    setIsDirectFileDragActive(false);
                    handleDirectFileSelection(event.dataTransfer.files?.[0] ?? null);
                  }}
                >
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    className="hidden"
                    onChange={event => handleDirectFileSelection(event.target.files?.[0] ?? null)}
                  />
                  <Upload size={20} className="mb-3 mt-15 text-neutral-400" />
                  <p className="text-sm text-neutral-700">
                    <span className={UPLOAD_DROPZONE_CTA_CLASS}>Upload a file</span> or drag and drop
                  </p>
                  <p className="mt-1 mb-15 text-xs text-neutral-500">PDF, PNG, JPG up to 10MB</p>
                </label>
                {directFile && (
                  <p className="text-xs text-neutral-600">
                    Selected: <span className="font-semibold text-neutral-800">{directFile.name}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="lg"
                  loading={isDirectIssuing}
                  icon={<ClipboardCheck size={14} />}
                  className="rounded-xl"
                >
                  Issue Credential
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  icon={<X size={14} />}
                  className="rounded-xl"
                  onClick={() => setIsDirectIssueModalOpen(false)}
                >
                  Close
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
      </AnimatePresence>
      , modalRoot)}

      <Card title="Issue From Approved Requests">
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-left">
            <thead className="bg-neutral-50 text-xs font-semibold  text-neutral-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Requested</th>
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
                  <tr key={request.id} className="cursor-pointer hover:bg-neutral-50/70" onClick={() => setSelectedRequestId(request.id)}>
                    <td className="px-4 py-3 text-sm text-neutral-700">
                      {(() => {
                        const student = studentById.get(request.studentId);
                        if (!student) return request.studentId;

                        return (
                          <div className="flex items-center gap-3">
                            <UserAvatar initials={getUserInitials(student)} />
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
                    <td className="px-4 py-3 text-sm text-neutral-600">{getRequestTypeLabel(request)}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{formatDateTime(request.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          disabled={request.deliveryMethod === 'PHYSICAL'}
                          onClick={event => {
                            event.stopPropagation();
                            setIssuingRequestId(request.id);
                          }}
                          size="sm"
                          icon={<ClipboardCheck size={13} />}
                          className="rounded-lg"
                          title={
                            request.deliveryMethod === 'PHYSICAL'
                              ? 'Digital issuance is blocked for PHYSICAL delivery requests.'
                              : 'Issue credential with upload form'
                          }
                        >
                          Issue
                        </Button>
                        {(request.deliveryMethod === 'PHYSICAL' || request.deliveryMethod === 'BOTH') && (
                          <Button
                            disabled={updatingRequestId === request.id || (request.deliveryMethod === 'BOTH' && !request.credentialId)}
                            onClick={event => {
                              event.stopPropagation();
                              void onRequestAction(request.id, 'MARK_PHYSICAL_CLAIMED');
                            }}
                            variant="secondary"
                            size="sm"
                            className="rounded-lg"
                            title={
                              request.deliveryMethod === 'BOTH' && !request.credentialId
                                ? 'Issue/link the digital credential first for BOTH delivery.'
                                : 'Mark physical credential as claimed and complete the request.'
                            }
                          >
                            Mark Claimed
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <AnimatePresence>
        {modalRoot && issuingRequest ? createPortal(
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={MODAL_BACKDROP_VARIANTS}
            transition={MODAL_TRANSITION}
            className="fixed inset-0 z-90 flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-[1px]"
            onClick={() => {
              setIssuingRequestId(null);
              setIsIssueFileDragActive(false);
            }}
          >
            <motion.div
              initial="initial"
              animate="animate"
              exit="exit"
              variants={MODAL_PANEL_VARIANTS}
              transition={MODAL_TRANSITION}
              className="w-full max-w-2xl rounded-lg border border-neutral-200 bg-white shadow-lg"
              onClick={event => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Issue Credential</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Attach the required document and specify expiry details for the credential.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIssuingRequestId(null);
                    setIsIssueFileDragActive(false);
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center text-neutral-500 transition-colors hover:text-neutral-900"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-5 p-5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="request-issue-file-upload" className="text-sm font-semibold text-neutral-800">
                    Document File
                    {!issuingRequest.credentialId && <span className="ml-1 text-rose-500">*</span>}
                  </label>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => document.getElementById('request-issue-file-upload')?.click()}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        document.getElementById('request-issue-file-upload')?.click();
                      }
                    }}
                    onDragOver={event => {
                      event.preventDefault();
                      setIsIssueFileDragActive(true);
                    }}
                    onDragLeave={event => {
                      event.preventDefault();
                      setIsIssueFileDragActive(false);
                    }}
                    onDrop={event => {
                      event.preventDefault();
                      setIsIssueFileDragActive(false);
                      onIssueFileChange(issuingRequest.id, event.dataTransfer.files?.[0] ?? null);
                    }}
                    className={getUploadDropzoneClass({
                      active: isIssueFileDragActive,
                      className: 'flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center transition-colors',
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
                    type="file"
                    id="request-issue-file-upload"
                    accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                    className="hidden"
                    onChange={event => onIssueFileChange(issuingRequest.id, event.target.files?.[0] ?? null)}
                  />
                </div>
                {supportsExpiryDate(issuingRequest.type) && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="request-issue-expiry-date" className="text-sm font-semibold text-neutral-800">
                      Expiry Date
                      {issuingRequestRequiresExpiry && <span className="ml-1 text-rose-500">*</span>}
                    </label>
                    <input
                      type="date"
                      id="request-issue-expiry-date"
                      value={issueExpiryByRequestId[issuingRequest.id] || ''}
                      onChange={event => onIssueExpiryChange(issuingRequest.id, event.target.value)}
                      className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                      required={issuingRequestRequiresExpiry}
                    />
                  </div>
                )}
                <div className="flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIssuingRequestId(null);
                      setIsIssueFileDragActive(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleConfirmRequestIssue}
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
            </motion.div>
          </motion.div>,
          modalRoot,
        ) : null}
      </AnimatePresence>
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

      <Card title="Manage Student Credentials">
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-left">
            <thead className="bg-neutral-50 text-xs font-semibold  text-neutral-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Credential</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Update</th>
                <th className="px-4 py-3 text-right">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {isLoadingCredentials && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-neutral-500">
                    Loading institution credentials...
                  </td>
                </tr>
              )}
              {!isLoadingCredentials && institutionCredentials.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-neutral-500">
                    No credentials found for your institution.
                  </td>
                </tr>
              )}
              {!isLoadingCredentials &&
                institutionCredentials.map(credential => {
                  const isRevoked = credential.status === 'REVOKED';
                  const isExpired = credential.status === 'EXPIRED';
                  const isLockedForStatusUpdate = isRevoked || isExpired;
                  const allowedStatusOptions = CREDENTIAL_STATUS_OPTIONS[credential.status] ?? [credential.status];
                  const targetStatus = statusByCredentialId[credential.id] || credential.status;
                  const isStatusUnchanged = targetStatus === credential.status;
                  const student = studentById.get(credential.studentId);
                  return (
                    <tr key={credential.id} className="hover:bg-neutral-50/70">
                      <td className="px-4 py-3 text-sm text-neutral-700">
                        {student ? (
                          <div className="flex items-center gap-3">
                            <UserAvatar initials={getUserInitials(student)} />
                            <div>
                              <p className="font-semibold text-neutral-900">{getStudentFullName(student)}</p>
                              <p className="mt-1 text-xs text-neutral-500">{student.email}</p>
                            </div>
                          </div>
                        ) : credential.studentId}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-neutral-900">{credential.title}</p>
                        <p className="mt-1 text-xs text-neutral-500">{credential.type}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={credential.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">{formatDateTime(credential.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <select
                            onClick={event => event.stopPropagation()}
                            value={targetStatus}
                            onChange={event =>
                              setStatusByCredentialId(previous => ({
                                ...previous,
                                [credential.id]: event.target.value as CredentialStatus,
                              }))
                            }
                            disabled={isLockedForStatusUpdate}
                            className="h-9 rounded-lg border border-neutral-200 bg-neutral-50 px-2 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {allowedStatusOptions.map(status => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={event => {
                              event.stopPropagation();
                              setUpdatingCredentialId(credential.id);
                              void onCredentialStatusUpdate(credential.id, targetStatus)
                                .catch(() => undefined)
                                .finally(() =>
                                  setUpdatingCredentialId(current => (current === credential.id ? null : current)),
                                );
                            }}
                            disabled={updatingCredentialId === credential.id || isLockedForStatusUpdate || isStatusUnchanged}
                            className="inline-flex h-9 items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-xs font-semibold text-neutral-700 hover:bg-SLATE-700-TEST-MARKER disabled:opacity-50"
                          >
                            Save
                          </button>
                          <Button
                            onClick={event => {
                              event.stopPropagation();
                              setReissueModalCredentialId(credential.id);
                            }}
                            disabled={reissuingCredentialId === credential.id || isRevoked}
                            size="sm"
                            icon={<ClipboardCheck size={12} />}
                            className="rounded-lg"
                          >
                            Re-issue
                          </Button>
                          {isLockedForStatusUpdate && (
                            <span className="inline-flex h-9 items-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-[11px] font-semibold  text-rose-700">
                              Locked
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>

      <AnimatePresence>
        {modalRoot && reissueCredential ? createPortal(
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={MODAL_BACKDROP_VARIANTS}
            transition={MODAL_TRANSITION}
            className="fixed inset-0 z-90 flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-[1px]"
            onClick={() => {
              setReissueModalCredentialId(null);
              setIsReissueFileDragActive(false);
            }}
          >
            <motion.div
              initial="initial"
              animate="animate"
              exit="exit"
              variants={MODAL_PANEL_VARIANTS}
              transition={MODAL_TRANSITION}
              className="w-full max-w-2xl rounded-lg border border-neutral-200 bg-white shadow-lg"
              onClick={event => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Re-issue Credential</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Upload a replacement credential file before re-issuing this record.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReissueModalCredentialId(null);
                    setIsReissueFileDragActive(false);
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center text-neutral-500 transition-colors hover:text-neutral-900"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-5 p-5">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <p className="text-sm font-semibold text-neutral-900">{reissueCredential.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">{reissueCredential.type}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="credential-reissue-file-upload" className="text-sm font-semibold text-neutral-800">
                    Replacement Credential<span className="ml-1 text-rose-500">*</span>
                  </label>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => document.getElementById('credential-reissue-file-upload')?.click()}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        document.getElementById('credential-reissue-file-upload')?.click();
                      }
                    }}
                    onDragOver={event => {
                      event.preventDefault();
                      setIsReissueFileDragActive(true);
                    }}
                    onDragLeave={event => {
                      event.preventDefault();
                      setIsReissueFileDragActive(false);
                    }}
                    onDrop={event => {
                      event.preventDefault();
                      setIsReissueFileDragActive(false);
                      setReissueFileByCredentialId(previous => ({
                        ...previous,
                        [reissueCredential.id]: event.dataTransfer.files?.[0] ?? null,
                      }));
                    }}
                    className={getUploadDropzoneClass({
                      active: isReissueFileDragActive,
                      className: 'flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center transition-colors',
                    })}
                  >
                    <Upload size={28} className="mb-3 text-neutral-400" />
                    <p className="text-base text-neutral-700">
                      <span className={UPLOAD_DROPZONE_CTA_CLASS}>Upload a file</span> or drag and drop
                    </p>
                    <p className="mt-2 text-sm text-neutral-500">PDF, PNG, JPG up to 10MB</p>
                    {reissueFileByCredentialId[reissueCredential.id] && (
                      <p className="mt-4 max-w-full truncate rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm font-medium text-neutral-700" title={reissueFileByCredentialId[reissueCredential.id]?.name || undefined}>
                        {reissueFileByCredentialId[reissueCredential.id]?.name}
                      </p>
                    )}
                  </div>
                  <input
                    type="file"
                    id="credential-reissue-file-upload"
                    accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                    className="hidden"
                    onChange={event =>
                      setReissueFileByCredentialId(previous => ({
                        ...previous,
                        [reissueCredential.id]: event.target.files?.[0] ?? null,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setReissueModalCredentialId(null);
                      setIsReissueFileDragActive(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setReissuingCredentialId(reissueCredential.id);
                      void handleConfirmCredentialReissue()
                        .catch(() => undefined)
                        .finally(() =>
                          setReissuingCredentialId(current => (current === reissueCredential.id ? null : current)),
                        );
                    }}
                    disabled={!reissueFileByCredentialId[reissueCredential.id] || reissuingCredentialId === reissueCredential.id}
                    loading={reissuingCredentialId === reissueCredential.id}
                  >
                    Confirm & Re-issue
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>,
          modalRoot,
        ) : null}
      </AnimatePresence>
    </div>
  );
}


