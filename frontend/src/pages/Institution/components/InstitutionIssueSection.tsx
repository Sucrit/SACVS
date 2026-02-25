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
const CREDENTIAL_STATUSES: CredentialStatus[] = ['PENDING', 'VERIFIED', 'ISSUED', 'REVOKED', 'EXPIRED'];

interface InstitutionIssueSectionProps {
  students: User[];
  credentials: Credential[];
  isLoadingCredentials: boolean;
  requests: CredentialRequest[];
  isLoadingRequests: boolean;
  issueFileByRequestId: Record<string, File | null>;
  onIssueFileChange: (requestId: string, file: File | null) => void;
  onRequestAction: (requestId: string, action: 'APPROVE' | 'REJECT' | 'ISSUE') => Promise<void>;
  onRefresh: () => void;
  onDirectIssue: (payload: {
    studentId: string;
    type: CredentialType;
    title: string;
    description?: string;
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
  onIssueFileChange,
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

    setIsDirectIssuing(true);
    try {
      await onDirectIssue({
        studentId,
        type: directForm.type,
        title,
        description: description || undefined,
        file: directFile,
      });
      setDirectForm({
        studentId: '',
        type: 'TRANSCRIPT',
        title: '',
        description: '',
      });
      setDirectFile(null);
    } catch (error) {
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
              onChange={event => setDirectForm(previous => ({ ...previous, type: event.target.value as CredentialType }))}
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
            >
              <ClipboardCheck size={13} />
              {isDirectIssuing ? 'Issuing...' : 'Issue Credential'}
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
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoadingRequests && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                    Loading approved requests...
                  </td>
                </tr>
              )}
              {!isLoadingRequests && readyToIssue.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                    No approved requests ready for issuance.
                  </td>
                </tr>
              )}
              {!isLoadingRequests &&
                readyToIssue.map(request => (
                  <tr key={request.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-sm text-slate-700">{studentNameById.get(request.studentId) || request.studentId}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{request.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{request.id}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{request.type}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(request.createdAt)}</td>
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
                        disabled={!request.credentialId && !issueFileByRequestId[request.id]}
                        onClick={() => void onRequestAction(request.id, 'ISSUE')}
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50"
                        title={!request.credentialId && !issueFileByRequestId[request.id] ? 'Attach a file to issue this credential.' : 'Issue Credential'}
                      >
                        <ClipboardCheck size={13} />
                        Issue
                      </button>
                    </td>
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
                          className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs outline-none"
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
                          disabled={updatingCredentialId === credential.id}
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
                          disabled={reissuingCredentialId === credential.id}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50"
                        >
                          <ClipboardCheck size={12} />
                          Re-issue
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
