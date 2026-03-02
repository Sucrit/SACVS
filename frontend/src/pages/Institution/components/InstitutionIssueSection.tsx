import { FormEvent, useMemo, useState } from 'react';
import { ClipboardCheck, RefreshCw, Upload } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import {
  AiDecision,
  Credential,
  CredentialAiReport,
  CredentialRequest,
  CredentialStatus,
  CredentialType,
} from '../../../services/credential.service';
import { User } from '../../../services/user.service';
import { formatDateTime, getStudentFullName } from '../utils';

const CREDENTIAL_TYPES: CredentialType[] = ['TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'];
const CREDENTIAL_STATUSES: CredentialStatus[] = ['PENDING', 'AI_REVIEW', 'ISSUED', 'REVOKED', 'EXPIRED'];
const EXPIRY_ALLOWED_TYPES: CredentialType[] = ['CERTIFICATE', 'LICENSE'];
type CertificateCategory = 'ACADEMIC' | 'PROFESSIONAL';
const DEFAULT_CERTIFICATE_CATEGORY: CertificateCategory = 'ACADEMIC';
const CERTIFICATE_CATEGORIES: CertificateCategory[] = ['ACADEMIC', 'PROFESSIONAL'];

const supportsExpiryDate = (type: CredentialType) => EXPIRY_ALLOWED_TYPES.includes(type);
const requiresExpiryDate = (
  type: CredentialType,
  certificateCategory: CertificateCategory = DEFAULT_CERTIFICATE_CATEGORY,
) => type === 'LICENSE' || (type === 'CERTIFICATE' && certificateCategory === 'PROFESSIONAL');

interface InstitutionIssueSectionProps {
  students: User[];
  credentials: Credential[];
  isLoadingCredentials: boolean;
  aiQueue: Credential[];
  isLoadingAiQueue: boolean;
  aiDecisionFilter: 'ALL' | AiDecision;
  onAiDecisionFilterChange: (value: 'ALL' | AiDecision) => void;
  selectedAiCredentialId: string | null;
  selectedAiReport: CredentialAiReport | null;
  isLoadingAiReport: boolean;
  aiActionCredentialId: string | null;
  onSelectAiCredential: (credentialId: string) => void;
  onAiReviewAction: (
    credentialId: string,
    action: 'APPROVE' | 'REJECT' | 'OVERRIDE',
    reason?: string,
    label?: 'CLEAN' | 'FRAUD' | 'UNSURE',
  ) => void;
  onAiReanalyze: (credentialId: string) => void;
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
  aiQueue,
  isLoadingAiQueue,
  aiDecisionFilter,
  onAiDecisionFilterChange,
  selectedAiCredentialId,
  selectedAiReport,
  isLoadingAiReport,
  aiActionCredentialId,
  onSelectAiCredential,
  onAiReviewAction,
  onAiReanalyze,
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
  const [overrideReasonByCredentialId, setOverrideReasonByCredentialId] = useState<Record<string, string>>({});
  const [labelByCredentialId, setLabelByCredentialId] = useState<
    Record<string, 'CLEAN' | 'FRAUD' | 'UNSURE'>
  >({});

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

  const normalizedSignals = useMemo(() => {
    const rawSignals = selectedAiReport?.aiSignals;
    if (!rawSignals) return [];
    if (Array.isArray(rawSignals)) {
      return rawSignals
        .filter(entry => Boolean(entry && typeof entry === 'object'))
        .map(entry => ({
          signalId: (entry as { signalId?: string }).signalId || 'unknown_signal',
          severity: (entry as { severity?: string }).severity || 'UNKNOWN',
          confidence:
            typeof (entry as { confidence?: number }).confidence === 'number'
              ? ((entry as { confidence?: number }).confidence as number)
              : 0,
          evidence: (entry as { evidence?: string }).evidence || 'No evidence provided.',
        }));
    }
    return [];
  }, [selectedAiReport?.aiSignals]);

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
                              : 'Issue Credential'
                        }
                      >
                        <ClipboardCheck size={13} />
                        Issue
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

      <Card title="AI Review Queue">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.08em] text-slate-500">
              Credentials currently waiting on AI validation review controls.
            </p>
            <select
              value={aiDecisionFilter}
              onChange={event => onAiDecisionFilterChange(event.target.value as 'ALL' | AiDecision)}
              className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs outline-none"
            >
              <option value="ALL">All decisions</option>
              <option value="PENDING">PENDING</option>
              <option value="CLEAR">CLEAR</option>
              <option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option>
              <option value="BLOCK">BLOCK</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Credential</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">AI Decision</th>
                  <th className="px-4 py-3">Review Status</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoadingAiQueue && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                      Loading AI queue...
                    </td>
                  </tr>
                )}
                {!isLoadingAiQueue && aiQueue.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                      No credentials in AI queue for the selected filter.
                    </td>
                  </tr>
                )}
                {!isLoadingAiQueue &&
                  aiQueue.map(credential => (
                    <tr
                      key={credential.id}
                      className={`hover:bg-slate-50/70 ${
                        selectedAiCredentialId === credential.id ? 'bg-cyan-50/60' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">{credential.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{credential.type}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {studentNameById.get(credential.studentId) || credential.studentId}
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={credential.aiDecision || 'PENDING'} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={credential.aiReviewStatus || 'PENDING'} />
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                        {typeof credential.aiScore === 'number' ? credential.aiScore.toFixed(2) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onSelectAiCredential(credential.id)}
                            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            View Report
                          </button>
                          <button
                            onClick={() => onAiReanalyze(credential.id)}
                            disabled={aiActionCredentialId === credential.id}
                            className="inline-flex h-9 items-center rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50"
                          >
                            {aiActionCredentialId === credential.id ? 'Requeueing...' : 'Reanalyze'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            {isLoadingAiReport && (
              <p className="text-sm text-slate-600">Loading AI report...</p>
            )}
            {!isLoadingAiReport && !selectedAiReport && (
              <p className="text-sm text-slate-600">
                Select a credential in the AI queue to inspect signals and perform review actions.
              </p>
            )}
            {!isLoadingAiReport && selectedAiReport && selectedAiCredentialId && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge status={selectedAiReport.aiDecision || 'PENDING'} />
                    <Badge status={selectedAiReport.aiReviewStatus || 'PENDING'} />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                    Model {selectedAiReport.aiModel || 'unknown'} {selectedAiReport.aiModelVersion || ''}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-slate-500">AI Summary</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {(selectedAiReport.aiReport?.summary as string) || 'No summary available.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Top Signals</p>
                    {normalizedSignals.length === 0 && (
                      <p className="mt-2 text-sm text-slate-600">No structured signals available.</p>
                    )}
                    {normalizedSignals.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {normalizedSignals.slice(0, 4).map(signal => (
                          <div key={`${signal.signalId}-${signal.evidence}`} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                            <p className="text-xs font-semibold text-slate-700">
                              {signal.signalId} ({signal.severity})
                            </p>
                            <p className="mt-1 text-xs text-slate-600">{signal.evidence}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              Confidence: {Math.max(0, Math.min(1, signal.confidence)).toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Review Controls</p>
                    <div className="mt-2 space-y-2">
                      <select
                        value={labelByCredentialId[selectedAiCredentialId] || 'UNSURE'}
                        onChange={event =>
                          setLabelByCredentialId(previous => ({
                            ...previous,
                            [selectedAiCredentialId]: event.target.value as 'CLEAN' | 'FRAUD' | 'UNSURE',
                          }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs outline-none"
                      >
                        <option value="UNSURE">UNSURE</option>
                        <option value="CLEAN">CLEAN</option>
                        <option value="FRAUD">FRAUD</option>
                      </select>
                      <input
                        value={overrideReasonByCredentialId[selectedAiCredentialId] || ''}
                        onChange={event =>
                          setOverrideReasonByCredentialId(previous => ({
                            ...previous,
                            [selectedAiCredentialId]: event.target.value,
                          }))
                        }
                        placeholder="Reason (required for OVERRIDE)"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs outline-none"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() =>
                            onAiReviewAction(
                              selectedAiCredentialId,
                              'APPROVE',
                              undefined,
                              labelByCredentialId[selectedAiCredentialId] || 'UNSURE',
                            )
                          }
                          disabled={aiActionCredentialId === selectedAiCredentialId}
                          className="inline-flex h-9 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() =>
                            onAiReviewAction(
                              selectedAiCredentialId,
                              'REJECT',
                              overrideReasonByCredentialId[selectedAiCredentialId],
                              labelByCredentialId[selectedAiCredentialId] || 'FRAUD',
                            )
                          }
                          disabled={aiActionCredentialId === selectedAiCredentialId}
                          className="inline-flex h-9 items-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() =>
                            onAiReviewAction(
                              selectedAiCredentialId,
                              'OVERRIDE',
                              overrideReasonByCredentialId[selectedAiCredentialId],
                              labelByCredentialId[selectedAiCredentialId] || 'UNSURE',
                            )
                          }
                          disabled={aiActionCredentialId === selectedAiCredentialId}
                          className="inline-flex h-9 items-center rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50"
                        >
                          Override
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
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
                        >
                          <ClipboardCheck size={12} />
                          Re-issue
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
