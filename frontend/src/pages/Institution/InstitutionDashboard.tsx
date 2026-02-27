import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Credential,
  CredentialRequest,
  CredentialRequestStatus,
  CredentialService,
  CredentialStatus,
  CredentialType,
} from '../../services/credential.service';
import {
  InstitutionStudentPayload,
  User,
  UserService,
  UserStatus,
} from '../../services/user.service';
import InstitutionStudentsSection from './components/InstitutionStudentsSection';
import InstitutionRequestsSection from './components/InstitutionRequestsSection';
import InstitutionIssueSection from './components/InstitutionIssueSection';
import InstitutionNotificationsSection from './components/InstitutionNotificationsSection';
import {
  ActivityEvent,
  DEFAULT_STUDENT_FORM,
  NotificationTarget,
  OutboundNotification,
  RequestStatusFilter,
  StudentFormState,
  StudentStatusFilter,
} from './types';
import {
  createClientId,
  getApiErrorMessage,
  getInstitutionSection,
  parseCsvStudents,
} from './utils';

const toStudentFormState = (student: User): StudentFormState => ({
  email: student.email,
  firstName: student.firstName,
  middleName: student.middleName || '',
  lastName: student.lastName,
  studentNumber: student.profile?.studentNumber || '',
  courseOfStudy: student.profile?.courseOfStudy || '',
  yearLevel: student.profile?.yearLevel || '',
  department: student.profile?.department || '',
  status: student.status,
});

type CertificateCategory = 'ACADEMIC' | 'PROFESSIONAL';

const EXPIRY_ALLOWED_TYPES: CredentialType[] = ['CERTIFICATE', 'LICENSE'];
const DEFAULT_CERTIFICATE_CATEGORY: CertificateCategory = 'ACADEMIC';
const supportsExpiryDate = (type: CredentialType) => EXPIRY_ALLOWED_TYPES.includes(type);
const requiresExpiryDate = (type: CredentialType, certificateCategory: CertificateCategory = DEFAULT_CERTIFICATE_CATEGORY) =>
  type === 'LICENSE' || (type === 'CERTIFICATE' && certificateCategory === 'PROFESSIONAL');

const toIsoDateFromInput = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

export default function InstitutionDashboard() {
  const location = useLocation();
  const section = getInstitutionSection(location.pathname);

  const [requests, setRequests] = useState<CredentialRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [requestsHint, setRequestsHint] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState<RequestStatusFilter>('ALL');
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [rejectionReasonByRequestId, setRejectionReasonByRequestId] = useState<Record<string, string>>({});
  const [issueFileByRequestId, setIssueFileByRequestId] = useState<Record<string, File | null>>({});
  const [issueExpiryByRequestId, setIssueExpiryByRequestId] = useState<Record<string, string>>({});
  const [issueCertificateCategoryByRequestId, setIssueCertificateCategoryByRequestId] = useState<Record<string, CertificateCategory>>({});
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(true);

  const [students, setStudents] = useState<User[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [studentsHint, setStudentsHint] = useState<string | null>(null);
  const [createStudentError, setCreateStudentError] = useState<string | null>(null);
  const [createStudentHint, setCreateStudentHint] = useState<string | null>(null);
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null);
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState<StudentStatusFilter>('ALL');
  const [studentDepartmentFilter, setStudentDepartmentFilter] = useState('ALL');
  const [studentForm, setStudentForm] = useState<StudentFormState>(DEFAULT_STUDENT_FORM);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editStudentForm, setEditStudentForm] = useState<StudentFormState>(DEFAULT_STUDENT_FORM);
  const [editStudentError, setEditStudentError] = useState<string | null>(null);
  const [editStudentHint, setEditStudentHint] = useState<string | null>(null);

  const [, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [outboundNotifications, setOutboundNotifications] = useState<OutboundNotification[]>([]);
  const [notificationTarget, setNotificationTarget] = useState<NotificationTarget>('ALL');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [notificationHint, setNotificationHint] = useState<string | null>(null);

  const createEvent = useCallback((type: ActivityEvent['type'], title: string, description: string) => {
    setActivityEvents(previous => [{ id: createClientId(), type, title, description, createdAt: new Date().toISOString() }, ...previous].slice(0, 100));
  }, []);

  const loadRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    setRequestsError(null);
    try {
      setRequests(await CredentialService.listRequests());
    } catch (error) {
      setRequests([]);
      setRequestsError('Unable to load verification requests from the server.');
      console.error('Failed to load institution requests:', error);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    setIsLoadingStudents(true);
    setStudentsError(null);
    try {
      setStudents(await UserService.listInstitutionStudents());
    } catch (error) {
      setStudents([]);
      setStudentsError('Unable to load students from the server.');
      console.error('Failed to load institution students:', error);
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  const loadCredentials = useCallback(async () => {
    setIsLoadingCredentials(true);
    try {
      const data = await CredentialService.list();
      setCredentials(data);
    } catch (error) {
      setCredentials([]);
      setRequestsError('Unable to load student credentials from the server.');
      console.error('Failed to load institution credentials:', error);
    } finally {
      setIsLoadingCredentials(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
    void loadStudents();
    void loadCredentials();
    createEvent('SYSTEM', 'Institution workspace initialized', 'Institution frontend sections loaded.');
  }, [createEvent, loadRequests, loadStudents, loadCredentials]);

  const pendingCount = requests.filter(request => request.status === 'PENDING').length;
  const studentCounts = useMemo(
    () => ({
      total: students.length,
      pending: students.filter(student => student.status === 'PENDING').length,
      approved: students.filter(student => student.status === 'APPROVED').length,
      rejected: students.filter(student => student.status === 'REJECTED').length,
      suspended: students.filter(student => student.status === 'SUSPENDED').length,
    }),
    [students],
  );

  const departmentOptions = useMemo(() => {
    const values = new Set<string>();
    students.forEach(student => {
      if (student.profile?.department) values.add(student.profile.department);
    });
    return ['ALL', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [students]);

  const filteredStudents = useMemo(() => {
    const keyword = studentSearch.trim().toLowerCase();
    return students.filter(student => {
      if (studentStatusFilter !== 'ALL' && student.status !== studentStatusFilter) return false;
      if (studentDepartmentFilter !== 'ALL' && student.profile?.department !== studentDepartmentFilter) return false;
      if (!keyword) return true;
      const searchable = [
        student.firstName,
        student.middleName || '',
        student.lastName,
        student.email,
        student.profile?.studentNumber || '',
        student.profile?.department || '',
      ].join(' ').toLowerCase();
      return searchable.includes(keyword);
    });
  }, [studentDepartmentFilter, studentSearch, studentStatusFilter, students]);

  const filteredRequests = useMemo(() => {
    const studentById = new Map(students.map(student => [student.id, student] as const));
    const keyword = requestSearch.trim().toLowerCase();
    return requests.filter(request => {
      if (requestStatusFilter !== 'ALL' && request.status !== requestStatusFilter) return false;
      if (!keyword) return true;
      const student = studentById.get(request.studentId);
      const studentName = student
        ? [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ')
        : '';
      const studentNumber = student?.profile?.studentNumber || '';
      const searchable = [
        request.id,
        request.title,
        request.type,
        request.status,
        request.rejectionReason || '',
        studentName,
        studentNumber,
      ].join(' ').toLowerCase();
      return searchable.includes(keyword);
    });
  }, [requestSearch, requestStatusFilter, requests, students]);

  const setStudentFormValue = (field: keyof StudentFormState, value: string) => {
    setStudentForm(previous => ({ ...previous, [field]: value }));
  };

  const setEditStudentFormValue = (field: keyof StudentFormState, value: string) => {
    setEditStudentForm(previous => ({ ...previous, [field]: value }));
  };

  const handleCreateStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateStudentError(null);
    setCreateStudentHint(null);

    const payload: InstitutionStudentPayload = {
      email: studentForm.email.trim(),
      firstName: studentForm.firstName.trim(),
      middleName: studentForm.middleName.trim() || null,
      lastName: studentForm.lastName.trim(),
      studentNumber: studentForm.studentNumber.trim(),
      courseOfStudy: studentForm.courseOfStudy.trim(),
      yearLevel: studentForm.yearLevel.trim(),
      department: studentForm.department.trim(),
      status: 'APPROVED',
    };

    setIsSubmittingStudent(true);
    try {
      await UserService.createInstitutionStudent(payload);
      setStudentForm(DEFAULT_STUDENT_FORM);
      setCreateStudentHint('Student account created successfully.');
      createEvent('STUDENT', 'Student account created', `${payload.email} was added.`);
      await loadStudents();
    } catch (error) {
      setCreateStudentError(getApiErrorMessage(error) || 'Unable to create student account.');
      console.error('Failed to create student:', error);
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  const handleBulkCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStudentsError(null);
    setStudentsHint(null);
    setIsBulkImporting(true);
    try {
      const parsed = parseCsvStudents(await file.text());
      if (parsed.error) {
        setStudentsError(parsed.error);
        return;
      }
      const result = await UserService.createInstitutionStudentsBulk({ students: parsed.students });
      setStudentsHint(`Bulk import complete: ${result.created} created, ${result.failed.length} failed.`);
      createEvent('STUDENT', 'Bulk student import', `${result.created} created, ${result.failed.length} failed.`);
      await loadStudents();
    } catch (error) {
      setStudentsError('Unable to import students from CSV.');
      console.error('Failed bulk importing students:', error);
    } finally {
      setIsBulkImporting(false);
      event.target.value = '';
    }
  };

  const handleStudentStatusUpdate = async (studentId: string, status: UserStatus) => {
    setUpdatingStudentId(studentId);
    setStudentsError(null);
    setStudentsHint(null);
    try {
      const updated = await UserService.updateInstitutionStudentStatus(studentId, status);
      setStudents(previous => previous.map(student => (student.id === studentId ? { ...student, ...updated } : student)));
      createEvent('STUDENT', 'Student status changed', `${updated.email} status changed to ${status}.`);
    } catch (error) {
      setStudentsError('Unable to update student status.');
      console.error('Failed updating student status:', error);
    } finally {
      setUpdatingStudentId(null);
    }
  };

  const handleStartEditStudent = (student: User) => {
    setEditingStudentId(student.id);
    setEditStudentForm(toStudentFormState(student));
    setEditStudentError(null);
    setEditStudentHint(null);
  };

  const handleCancelEditStudent = () => {
    setEditingStudentId(null);
    setEditStudentError(null);
    setEditStudentHint(null);
  };

  const handleSaveEditedStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingStudentId) return;

    setEditStudentError(null);
    setEditStudentHint(null);

    const payload: InstitutionStudentPayload = {
      email: editStudentForm.email.trim(),
      firstName: editStudentForm.firstName.trim(),
      middleName: editStudentForm.middleName.trim() || null,
      lastName: editStudentForm.lastName.trim(),
      studentNumber: editStudentForm.studentNumber.trim(),
      courseOfStudy: editStudentForm.courseOfStudy.trim(),
      yearLevel: editStudentForm.yearLevel.trim(),
      department: editStudentForm.department.trim(),
      status: editStudentForm.status,
    };

    try {
      const updated = await UserService.updateInstitutionStudent(editingStudentId, payload);
      setStudents(previous => previous.map(student => (student.id === updated.id ? updated : student)));
      setEditStudentHint('Student profile updated successfully.');
      createEvent('STUDENT', 'Student profile updated', `${updated.email} was updated.`);
      setEditingStudentId(null);
    } catch (error) {
      setEditStudentError(getApiErrorMessage(error) || 'Unable to update student profile.');
      console.error('Failed updating student profile:', error);
    }
  };

  const handleRemoveStudent = async (student: User) => {
    if (!window.confirm(`Delete ${student.email}?\n\nThis will delete the student account in both database and Clerk.`)) {
      return;
    }

    setStudentsError(null);
    setStudentsHint(null);

    try {
      const result = await UserService.deleteInstitutionStudent(student.id);
      setStudents(previous => previous.filter(entry => entry.id !== student.id));
      setStudentsHint(result.message || `Deleted ${student.email}.`);
      createEvent('SECURITY', 'Student account deleted', `${student.email} was deleted from DB and Clerk.`);

      if (editingStudentId === student.id) {
        handleCancelEditStudent();
      }
    } catch (error) {
      setStudentsError(getApiErrorMessage(error) || 'Unable to delete student account.');
      console.error('Failed deleting student account:', error);
    }
  };

  const updateRequestStatus = async (
    requestId: string,
    status: Exclude<CredentialRequestStatus, 'PENDING' | 'CANCELLED'>,
    rejectionReason?: string,
    notes?: string,
    credentialId?: string,
  ) => {
    setUpdatingRequestId(requestId);
    setRequestsError(null);
    setRequestsHint(null);
    try {
      const updated = await CredentialService.updateRequestStatus(
        requestId,
        status,
        rejectionReason,
        notes,
        credentialId,
      );
      setRequests(previous => previous.map(request => (request.id === requestId ? { ...request, ...updated } : request)));
      return updated;
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const issueCredentialForRequest = async (request: CredentialRequest) => {
    let credentialId = request.credentialId;
    const selectedFile = issueFileByRequestId[request.id] ?? undefined;
    let uploadFileDuringIssue = selectedFile;
    const certificateCategory: CertificateCategory | undefined =
      request.type === 'CERTIFICATE'
        ? issueCertificateCategoryByRequestId[request.id] || DEFAULT_CERTIFICATE_CATEGORY
        : undefined;
    const rawExpiryDate = issueExpiryByRequestId[request.id] || '';
    const expiryDate = supportsExpiryDate(request.type) ? toIsoDateFromInput(rawExpiryDate) : undefined;
    if (requiresExpiryDate(request.type, certificateCategory || DEFAULT_CERTIFICATE_CATEGORY) && !expiryDate) {
      throw new Error('Expiry date is required for license and professional certificate credentials.');
    }
    const requestMetadata = {
      source: 'CREDENTIAL_REQUEST',
      requestId: request.id,
      deliveryMethod: request.deliveryMethod,
      purpose: request.purpose,
      ...(certificateCategory ? { certificateCategory } : {}),
    };

    if (!credentialId) {
      const created = await CredentialService.create({
        studentId: request.studentId,
        title: request.title,
        type: request.type,
        description: request.description || undefined,
        status: 'PENDING',
        metadata: requestMetadata,
        expiryDate,
        file: selectedFile,
      });
      credentialId = created.id;
      if (selectedFile) {
        uploadFileDuringIssue = undefined;
      }
    }

    await CredentialService.issue(credentialId, {
      description: request.description || undefined,
      issuedDate: new Date().toISOString(),
      metadata: requestMetadata,
      expiryDate,
      file: uploadFileDuringIssue,
    });

    await updateRequestStatus(
      request.id,
      'COMPLETED',
      undefined,
      `Credential issued by institution. Credential ID: ${credentialId}.`,
      credentialId,
    );

    setRequests(previous =>
      previous.map(entry => (entry.id === request.id ? { ...entry, credentialId } : entry)),
    );
    setIssueFileByRequestId(previous => {
      const next = { ...previous };
      delete next[request.id];
      return next;
    });
    setIssueExpiryByRequestId(previous => {
      const next = { ...previous };
      delete next[request.id];
      return next;
    });
    setIssueCertificateCategoryByRequestId(previous => {
      const next = { ...previous };
      delete next[request.id];
      return next;
    });

    return credentialId;
  };

  const handleRequestAction = async (requestId: string, action: 'APPROVE' | 'REJECT' | 'ISSUE') => {
    try {
      if (action === 'APPROVE') {
        await updateRequestStatus(requestId, 'APPROVED');
        setRequestsHint('Request approved.');
        createEvent('REQUEST', 'Credential request approved', `Request ${requestId} approved.`);
        return;
      }
      if (action === 'REJECT') {
        const reason = rejectionReasonByRequestId[requestId]?.trim() || 'Rejected by institution review.';
        await updateRequestStatus(requestId, 'REJECTED', reason);
        setRequestsHint('Request rejected.');
        createEvent('REQUEST', 'Credential request rejected', `Request ${requestId} rejected.`);
        return;
      }

      const request = requests.find(entry => entry.id === requestId);
      if (!request) {
        throw new Error('Credential request not found.');
      }

      const issuedCredentialId = await issueCredentialForRequest(request);
      setRequestsHint('Credential issued and request marked as completed.');
      createEvent(
        'REQUEST',
        'Credential issued',
        `Request ${requestId} completed with credential ${issuedCredentialId}.`,
      );
      await loadCredentials();
    } catch (error) {
      setRequestsError(getApiErrorMessage(error) || 'Unable to issue credential.');
      console.error('Failed handling request action:', error);
    }
  };

  const handleBulkRequestAction = async (action: 'APPROVE' | 'REJECT' | 'ISSUE') => {
    if (selectedRequestIds.length === 0) {
      setRequestsError('Select at least one request for bulk action.');
      return;
    }

    const results = await Promise.allSettled(
      selectedRequestIds.map(async requestId => {
        if (action === 'APPROVE') return updateRequestStatus(requestId, 'APPROVED');
        if (action === 'REJECT') {
          const reason = rejectionReasonByRequestId[requestId]?.trim() || 'Rejected during bulk review.';
          return updateRequestStatus(requestId, 'REJECTED', reason);
        }
        const request = requests.find(entry => entry.id === requestId);
        if (!request) {
          throw new Error(`Credential request ${requestId} not found.`);
        }
        return issueCredentialForRequest(request);
      }),
    );

    const succeeded = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    setSelectedRequestIds([]);
    setRequestsHint(`Bulk ${action.toLowerCase()} complete: ${succeeded} updated, ${failed} failed.`);
    createEvent('REQUEST', 'Bulk request processing', `${action} applied to ${results.length} requests; ${succeeded} succeeded.`);
    await loadCredentials();
  };

  const handleDirectIssueCredential = async (payload: {
    studentId: string;
    type: CredentialType;
    title: string;
    description?: string;
    expiryDate?: string;
    certificateCategory?: CertificateCategory;
    file: File;
  }) => {
    setRequestsError(null);
    setRequestsHint(null);
    try {
      const certificateCategory: CertificateCategory | undefined =
        payload.type === 'CERTIFICATE'
          ? payload.certificateCategory || DEFAULT_CERTIFICATE_CATEGORY
          : undefined;
      const normalizedExpiryDate = supportsExpiryDate(payload.type)
        ? toIsoDateFromInput(payload.expiryDate || '')
        : undefined;
      if (requiresExpiryDate(payload.type, certificateCategory || DEFAULT_CERTIFICATE_CATEGORY) && !normalizedExpiryDate) {
        throw new Error('Expiry date is required for license and professional certificate credentials.');
      }
      const directIssueMetadata = {
        source: 'INSTITUTION_DIRECT_ISSUE',
        ...(certificateCategory ? { certificateCategory } : {}),
      };

      const created = await CredentialService.create({
        studentId: payload.studentId,
        type: payload.type,
        title: payload.title,
        description: payload.description,
        status: 'PENDING',
        expiryDate: normalizedExpiryDate,
        file: payload.file,
        metadata: directIssueMetadata,
      });

      const issued = await CredentialService.issue(created.id, {
        issuedDate: new Date().toISOString(),
        description: payload.description,
        expiryDate: normalizedExpiryDate,
        metadata: directIssueMetadata,
      });

      setRequestsHint('Credential issued successfully.');
      createEvent(
        'REQUEST',
        'Credential issued directly',
        `Credential ${issued.id} issued to student ${payload.studentId}.`,
      );

      await loadCredentials();
      return issued;
    } catch (error) {
      const message = getApiErrorMessage(error) || 'Unable to issue credential directly.';
      throw new Error(message);
    }
  };

  const handleCredentialStatusUpdate = async (credentialId: string, status: CredentialStatus) => {
    setRequestsError(null);
    setRequestsHint(null);
    try {
      const updated = await CredentialService.updateStatus(credentialId, status);
      setCredentials(previous => previous.map(item => (item.id === credentialId ? updated : item)));
      setRequestsHint(`Credential status updated to ${status}.`);
      createEvent('REQUEST', 'Credential updated', `Credential ${credentialId} updated to ${status}.`);
    } catch (error) {
      setRequestsError(getApiErrorMessage(error) || 'Unable to update credential.');
      throw error;
    }
  };

  const handleCredentialReissue = async (credentialId: string, file?: File) => {
    setRequestsError(null);
    setRequestsHint(null);
    try {
      const issued = await CredentialService.issue(credentialId, {
        issuedDate: new Date().toISOString(),
        file,
      });
      setCredentials(previous => previous.map(item => (item.id === credentialId ? issued : item)));
      setRequestsHint('Credential re-issued successfully.');
      createEvent('REQUEST', 'Credential re-issued', `Credential ${credentialId} re-issued.`);
    } catch (error) {
      setRequestsError(getApiErrorMessage(error) || 'Unable to re-issue credential.');
      throw error;
    }
  };

  const handleNotificationSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotificationError(null);
    setNotificationHint(null);

    if (!notificationTitle.trim()) {
      setNotificationError('Notification title is required.');
      return;
    }
    if (!notificationMessage.trim()) {
      setNotificationError('Notification message is required.');
      return;
    }

    const entry: OutboundNotification = {
      id: createClientId(),
      target: notificationTarget,
      title: notificationTitle.trim(),
      message: notificationMessage.trim(),
      createdAt: new Date().toISOString(),
    };
    setOutboundNotifications(previous => [entry, ...previous]);
    setNotificationTitle('');
    setNotificationMessage('');
    setNotificationHint('Notification queued in frontend log. Backend delivery endpoint will be wired next.');
    createEvent('NOTIFICATION', 'Notification queued', `${entry.target}: ${entry.title}`);
  };

  return (
    <div className="space-y-6">
      {(requestsError || requestsHint) && (section === 'requests' || section === 'issue') && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${requestsError ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {requestsError || requestsHint}
        </div>
      )}
      {(studentsError || studentsHint || createStudentError || createStudentHint || editStudentError || editStudentHint) && section === 'students' && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${(studentsError || createStudentError || editStudentError) ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {studentsError || createStudentError || editStudentError || studentsHint || createStudentHint || editStudentHint}
        </div>
      )}
      {(notificationError || notificationHint) && section === 'notifications' && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${notificationError ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {notificationError || notificationHint}
        </div>
      )}

      {section === 'students' && (
        <InstitutionStudentsSection
          studentForm={studentForm}
          isSubmittingStudent={isSubmittingStudent}
          isBulkImporting={isBulkImporting}
          onSetStudentFormValue={setStudentFormValue}
          onCreateStudent={handleCreateStudent}
          onBulkCsvUpload={handleBulkCsvUpload}
          students={filteredStudents}
          isLoadingStudents={isLoadingStudents}
          studentSearch={studentSearch}
          studentStatusFilter={studentStatusFilter}
          studentDepartmentFilter={studentDepartmentFilter}
          departmentOptions={departmentOptions}
          onStudentSearchChange={setStudentSearch}
          onStudentStatusFilterChange={setStudentStatusFilter}
          onStudentDepartmentFilterChange={setStudentDepartmentFilter}
          onRefreshStudents={loadStudents}
          updatingStudentId={updatingStudentId}
          onStartEditStudent={handleStartEditStudent}
          onStudentStatusUpdate={handleStudentStatusUpdate}
          onRemoveStudent={handleRemoveStudent}
          editingStudentId={editingStudentId}
          editStudentForm={editStudentForm}
          onSetEditStudentFormValue={setEditStudentFormValue}
          onSaveEditedStudent={handleSaveEditedStudent}
          onCancelEditStudent={handleCancelEditStudent}
        />
      )}

      {section === 'requests' && (
        <InstitutionRequestsSection
          requests={filteredRequests}
          students={students}
          isLoadingRequests={isLoadingRequests}
          requestSearch={requestSearch}
          requestStatusFilter={requestStatusFilter}
          selectedRequestIds={selectedRequestIds}
          rejectionReasonByRequestId={rejectionReasonByRequestId}
          updatingRequestId={updatingRequestId}
          onRefresh={loadRequests}
          onSearchChange={setRequestSearch}
          onFilterChange={setRequestStatusFilter}
          onToggleRequest={(requestId: string) => {
            setSelectedRequestIds(previous => previous.includes(requestId) ? previous.filter(id => id !== requestId) : [...previous, requestId]);
          }}
          onReasonChange={(requestId: string, reason: string) => {
            setRejectionReasonByRequestId(previous => ({ ...previous, [requestId]: reason }));
          }}
          issueFileByRequestId={issueFileByRequestId}
          issueExpiryByRequestId={issueExpiryByRequestId}
          issueCertificateCategoryByRequestId={issueCertificateCategoryByRequestId}
          onIssueFileChange={(requestId: string, file: File | null) => {
            setIssueFileByRequestId(previous => ({ ...previous, [requestId]: file }));
          }}
          onIssueExpiryChange={(requestId: string, expiryDate: string) => {
            setIssueExpiryByRequestId(previous => ({ ...previous, [requestId]: expiryDate }));
          }}
          onIssueCertificateCategoryChange={(requestId: string, value: CertificateCategory) => {
            setIssueCertificateCategoryByRequestId(previous => ({ ...previous, [requestId]: value }));
          }}
          onRequestAction={handleRequestAction}
          onBulkAction={handleBulkRequestAction}
        />
      )}

      {section === 'issue' && (
        <InstitutionIssueSection
          students={students}
          credentials={credentials}
          isLoadingCredentials={isLoadingCredentials}
          requests={requests}
          isLoadingRequests={isLoadingRequests}
          onRefresh={() => {
            void loadRequests();
            void loadCredentials();
          }}
          onDirectIssue={handleDirectIssueCredential}
          onCredentialStatusUpdate={handleCredentialStatusUpdate}
          onCredentialReissue={handleCredentialReissue}
          issueFileByRequestId={issueFileByRequestId}
          issueExpiryByRequestId={issueExpiryByRequestId}
          issueCertificateCategoryByRequestId={issueCertificateCategoryByRequestId}
          onIssueFileChange={(requestId: string, file: File | null) => {
            setIssueFileByRequestId(previous => ({ ...previous, [requestId]: file }));
          }}
          onIssueExpiryChange={(requestId: string, expiryDate: string) => {
            setIssueExpiryByRequestId(previous => ({ ...previous, [requestId]: expiryDate }));
          }}
          onIssueCertificateCategoryChange={(requestId: string, value: CertificateCategory) => {
            setIssueCertificateCategoryByRequestId(previous => ({ ...previous, [requestId]: value }));
          }}
          onRequestAction={handleRequestAction}
        />
      )}

      {section === 'notifications' && (
        <InstitutionNotificationsSection
          notificationTarget={notificationTarget}
          notificationTitle={notificationTitle}
          notificationMessage={notificationMessage}
          pendingCount={pendingCount}
          pendingStudentCount={studentCounts.pending}
          suspendedStudentCount={studentCounts.suspended}
          notifications={outboundNotifications}
          onTargetChange={setNotificationTarget}
          onTitleChange={setNotificationTitle}
          onMessageChange={setNotificationMessage}
          onSubmit={handleNotificationSubmit}
        />
      )}
    </div>
  );
}
