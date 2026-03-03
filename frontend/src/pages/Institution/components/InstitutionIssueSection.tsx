import { FormEvent, useMemo, useState } from 'react';
import { ClipboardCheck, RefreshCw, Upload } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import {
  Credential,
  CredentialRequest,
  CredentialStatus,
  CredentialType,
} from '../../../services/credential.service';
import { User } from '../../../services/user.service';
import { formatDateTime, getStudentFullName } from '../utils';

const CREDENTIAL_TYPES: CredentialType[] = ['TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'];
const CREDENTIAL_STATUSES: CredentialStatus[] = ['PENDING', 'ISSUED', 'REVOKED', 'EXPIRED'];
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

interface InstitutionIssueSectionProps {
  students: User[];
  credentials: Credential[];
  isLoadingCredentials: boolean;
  requests: CredentialRequest[];
  isLoadingRequests: boolean;
  issueFileByRequestId: Record<string, File | null>;
  issueExpiryByRequestId: Record<string, string>;
  issueCertificateCategoryByRequestId: Record<string, CertificateCategory>;
  onIssueFileChange: (requestId: string, file: File | null) => void;
  onIssueExpiryChange: (requestId: string, expiryDate: string) => void;
  onIssueCertificateCategoryChange: (requestId: string, value: CertificateCategory) => void;
  onRequestAction: (requestId: string, action: 'APPROVE' | 'REJECT' | 'ISSUE') => Promise<void>;
  onRefresh: () => void;
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
  issueFileByRequestId,
  issueExpiryByRequestId,
  issueCertificateCategoryByRequestId,
  onIssueFileChange,
  onIssueExpiryChange,
  onIssueCertificateCategoryChange,
  onRequestAction,
  onRefresh,
  onDirectIssue,
  onCredentialStatusUpdate,
  onCredentialReissue,
}: InstitutionIssueSectionProps) {
  const [directForm, setDirectForm] = useState({
    studentId: '',
    type: 'TRANSCRIPT' as CredentialType,
    title: '',
    description: '',
    expiryDate: '',
    certificateCategory: DEFAULT_CERTIFICATE_CATEGORY as CertificateCategory,
  });
  const [directFile, setDirectFile] = useState<File | null>(null);
  const [directIssueError, setDirectIssueError] = useState<string | null>(null);
  const [isDirectIssuing, setIsDirectIssuing] = useState(false);

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
    setDirectIssueError(null);

    const studentId = directForm.studentId.trim();
    const title = directForm.title.trim();
    const description = directForm.description.trim();

    if (!studentId) {
      setDirectIssueError('Select a student.');
      return;
    }
    if (!title) {
      setDirectIssueError('Title is required.');
      return;
    }
    if (!directFile) {
      setDirectIssueError('Attach a credential file before issuing.');
      return;
    }
    if (requiresExpiryDate(directForm.type, directForm.certificateCategory) && !directForm.expiryDate) {
      setDirectIssueError('Expiry date is required for license and professional certificate credentials.');
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
    } catch (error) {
      if (error instanceof Error && error.message === 'STEP_UP_CANCELLED') {
        return;
      }
      const message = error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'Unable to issue credential directly.';
      setDirectIssueError(message);
    } finally {
      setIsDirectIssuing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card title="Institution Students">
          <p className="text-3xl font-bold text-slate-900">{eligibleStudents.length}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-500">Managed student accounts</p>
        </Card>
        <Card title="Ready To Issue">
          <p className="text-3xl font-bold text-cyan-700">{readyToIssue.length}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-500">Approved requests</p>
        </Card>
        <Card title="Student Credentials">
          <p className="text-3xl font-bold text-emerald-700">{institutionCredentials.length}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-500">Accessible in student dashboard</p>
        </Card>
      </div>

      <Card
        title="Direct Credential Issuance"
        action={
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      >
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

          <div>
            <button
              type="submit"
              disabled={isDirectIssuing}
              className="inline-flex h-10 items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-4 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50"
              title="OTP required before this action is applied"
            >
              <ClipboardCheck size={13} />
              {isDirectIssuing ? 'Issuing...' : 'Issue Credential'}
              {!isDirectIssuing && <span className={OTP_BADGE_CLASS}>OTP</span>}
            </button>
          </div>
          {directIssueError && <p className="text-xs text-rose-700">{directIssueError}</p>}
        </form>
      </Card>

      <Card title="Issue From Approved Requests">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Certificate Mode</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Expiry Date</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoadingRequests && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-500">
                    Loading approved requests...
                  </td>
                </tr>
              )}
              {!isLoadingRequests && readyToIssue.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-500">
                    No approved requests ready for issuance.
                  </td>
                </tr>
              )}
              {!isLoadingRequests &&
                readyToIssue.map(request => (
                  <tr key={request.id} className="hover:bg-slate-50/70">
                    {(() => {
                      const requestCertificateCategory =
                        request.type === 'CERTIFICATE'
                          ? issueCertificateCategoryByRequestId[request.id] || DEFAULT_CERTIFICATE_CATEGORY
                          : DEFAULT_CERTIFICATE_CATEGORY;
                      const requestRequiresExpiry = requiresExpiryDate(request.type, requestCertificateCategory);
                      return (
                        <>
                    <td className="px-4 py-3 text-sm text-slate-700">{studentNameById.get(request.studentId) || request.studentId}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{request.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{request.id}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{request.type}</td>
                    <td className="px-4 py-3">
                      {request.type === 'CERTIFICATE' ? (
                        <select
                          value={requestCertificateCategory}
                          onChange={event => onIssueCertificateCategoryChange(request.id, event.target.value as CertificateCategory)}
                          className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs outline-none"
                        >
                          {CERTIFICATE_CATEGORIES.map(category => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-400">Not applicable</span>
                      )}
                    </td>
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
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                          className="hidden"
                          onChange={event => onIssueFileChange(request.id, event.target.files?.[0] ?? null)}
                        />
                        <Upload size={12} />
                        {issueFileByRequestId[request.id]?.name || (request.credentialId ? 'Replace file' : 'Attach file')}
                      </label>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        disabled={
                          (!request.credentialId && !issueFileByRequestId[request.id]) ||
                          (requestRequiresExpiry && !issueExpiryByRequestId[request.id])
                        }
                        onClick={() => void onRequestAction(request.id, 'ISSUE')}
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50"
                        title={
                          !request.credentialId && !issueFileByRequestId[request.id]
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
                          value={statusByCredentialId[credential.id] || credential.status}
                          onChange={event =>
                            setStatusByCredentialId(previous => ({
                              ...previous,
                              [credential.id]: event.target.value as CredentialStatus,
                            }))
                          }
                          disabled={isRevoked}
                          className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {CREDENTIAL_STATUSES.map(status => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const targetStatus = statusByCredentialId[credential.id] || credential.status;
                            setUpdatingCredentialId(credential.id);
                            void onCredentialStatusUpdate(credential.id, targetStatus)
                              .catch(() => undefined)
                              .finally(() =>
                                setUpdatingCredentialId(current => (current === credential.id ? null : current)),
                              );
                          }}
                          disabled={updatingCredentialId === credential.id || isRevoked}
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
                        {isRevoked && (
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
