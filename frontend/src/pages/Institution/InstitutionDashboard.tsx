import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Credential,
  CredentialRequest,
  CredentialRequestStatus,
  CredentialService,
  CredentialStatus,
  CredentialType,
} from '../../services/credential.service';
import { AuditAction, AuditLogEntry, AuditService, AuditSeverity } from '../../services/audit.service';
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
import InstitutionOverviewSection from './components/InstitutionOverviewSection';
import InstitutionAnalyticsSection from './components/InstitutionAnalyticsSection';
import InstitutionReceiptVerifySection from './components/InstitutionReceiptVerifySection';
import InstitutionCredentialDetailsDrawer from './components/InstitutionCredentialDetailsDrawer';
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
import { useStepUp } from '../../hooks/useStepUp';
import { realtimeService } from '../../services/realtime.service';
import { useToast } from '../../hooks/useToast';

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
const getRequestCertificateCategory = (request: CredentialRequest): CertificateCategory => {
  const value = request.metadata && typeof request.metadata === 'object'
    ? (request.metadata as Record<string, unknown>).certificateCategory
    : undefined;
  return value === 'PROFESSIONAL' ? 'PROFESSIONAL' : DEFAULT_CERTIFICATE_CATEGORY;
};

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
  const [hasLoadedRequests, setHasLoadedRequests] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [requestsHint, setRequestsHint] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState<RequestStatusFilter>('ALL');
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [rejectionReasonByRequestId, setRejectionReasonByRequestId] = useState<Record<string, string>>({});
  const [issueFileByRequestId, setIssueFileByRequestId] = useState<Record<string, File | null>>({});
  const [issueExpiryByRequestId, setIssueExpiryByRequestId] = useState<Record<string, string>>({});
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(true);
  const [hasLoadedCredentials, setHasLoadedCredentials] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [hasLoadedAuditLogs, setHasLoadedAuditLogs] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState<'ALL' | AuditAction>('ALL');
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<'ALL' | AuditSeverity>('ALL');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(20);

  const [students, setStudents] = useState<User[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [hasLoadedStudents, setHasLoadedStudents] = useState(false);
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
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null);
  const [isCredentialDrawerOpen, setIsCredentialDrawerOpen] = useState(false);
  const { requestStepUpToken, stepUpModal } = useStepUp();
  const { showToast } = useToast();
  const refreshTimersRef = useRef<Record<'students' | 'requests' | 'credentials' | 'logs', number | null>>({
    students: null,
    requests: null,
    credentials: null,
    logs: null,
  });
  const hasInitializedRef = useRef(false);

  const createEvent = useCallback((type: ActivityEvent['type'], title: string, description: string) => {
    setActivityEvents(previous => [{ id: createClientId(), type, title, description, createdAt: new Date().toISOString() }, ...previous].slice(0, 100));
  }, []);

  useEffect(() => {
    if (requestsError) {
      showToast({ variant: 'error', message: requestsError });
    }
  }, [requestsError, showToast]);

  useEffect(() => {
    if (requestsHint) {
      showToast({ variant: 'success', message: requestsHint });
    }
  }, [requestsHint, showToast]);

  useEffect(() => {
    if (studentsError || createStudentError || editStudentError) {
      showToast({
        variant: 'error',
        message: studentsError || createStudentError || editStudentError || 'Unable to process student action.',
      });
    }
  }, [createStudentError, editStudentError, showToast, studentsError]);

  useEffect(() => {
    if (studentsHint || createStudentHint || editStudentHint) {
      showToast({
        variant: 'success',
        message: studentsHint || createStudentHint || editStudentHint || 'Student action completed successfully.',
      });
    }
  }, [createStudentHint, editStudentHint, showToast, studentsHint]);

  useEffect(() => {
    if (notificationError) {
      showToast({ variant: 'error', message: notificationError });
    }
  }, [notificationError, showToast]);

  useEffect(() => {
    if (notificationHint) {
      showToast({ variant: 'info', message: notificationHint });
    }
  }, [notificationHint, showToast]);

  const loadRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    setRequestsError(null);
    try {
      setRequests(await CredentialService.listRequests());
      setHasLoadedRequests(true);
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
      setHasLoadedStudents(true);
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
      setHasLoadedCredentials(true);
    } catch (error) {
      setCredentials([]);
      setRequestsError('Unable to load student credentials from the server.');
      console.error('Failed to load institution credentials:', error);
    } finally {
      setIsLoadingCredentials(false);
    }
  }, []);

  const upsertCredentialState = useCallback((updated: Credential) => {
    setCredentials(previous =>
      previous.some(item => item.id === updated.id)
        ? previous.map(item => (item.id === updated.id ? updated : item))
        : [updated, ...previous],
    );
  }, []);

  useEffect(() => {
    if ((section === 'overview' || section === 'analytics')) {
      if (!hasLoadedRequests) void loadRequests();
      if (!hasLoadedStudents) void loadStudents();
      if (!hasLoadedCredentials) void loadCredentials();
    }
    if (section === 'students' && !hasLoadedStudents) {
      void loadStudents();
    }
    if (section === 'requests') {
      if (!hasLoadedRequests) void loadRequests();
      if (!hasLoadedStudents) void loadStudents();
    }
    if (section === 'issue') {
      if (!hasLoadedRequests) void loadRequests();
      if (!hasLoadedStudents) void loadStudents();
      if (!hasLoadedCredentials) void loadCredentials();
    }
    if (!hasInitializedRef.current) {
      createEvent('SYSTEM', 'Institution workspace initialized', 'Institution frontend sections loaded.');
      hasInitializedRef.current = true;
    }
  }, [
    createEvent,
    hasLoadedCredentials,
    hasLoadedRequests,
    hasLoadedStudents,
    loadCredentials,
    loadRequests,
    loadStudents,
    section,
  ]);

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
      const stepUpToken = await requestStepUpToken({
        action: 'BULK_STUDENT_CREATE',
        title: 'Confirm Bulk Student Import',
        description: 'Enter the OTP sent to your email to continue with bulk student creation.',
      });
      const result = await UserService.createInstitutionStudentsBulk({ students: parsed.students }, stepUpToken);
      setStudentsHint(`Bulk import complete: ${result.created} created, ${result.failed.length} failed.`);
      createEvent('STUDENT', 'Bulk student import', `${result.created} created, ${result.failed.length} failed.`);
      await loadStudents();
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'STEP_UP_CANCELLED' || error.message === 'STEP_UP_IN_PROGRESS')
      ) {
        return;
      }
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

  const findCredentialForRequest = useCallback(
    (request: CredentialRequest): Credential | null => {
      if (request.credentialId) {
        const linked = credentials.find(entry => entry.id === request.credentialId);
        if (linked) return linked;
      }

      const matched = credentials.find(entry => {
        const metadata = entry.metadata;
        if (!metadata || typeof metadata !== 'object') return false;
        const data = metadata as Record<string, unknown>;
        return (
          data.source === 'CREDENTIAL_REQUEST' &&
          data.requestId === request.id &&
          entry.studentId === request.studentId &&
          entry.type === request.type
        );
      });

      return matched ?? null;
    },
    [credentials],
  );

  const issueCredentialForRequest = async (request: CredentialRequest) => {
    if (request.deliveryMethod === 'PHYSICAL') {
      throw new Error('Digital issuance is blocked for PHYSICAL delivery requests.');
    }

    let credentialId = request.credentialId;
    const selectedFile = issueFileByRequestId[request.id] ?? undefined;
    let uploadFileDuringIssue = selectedFile;
    const certificateCategory: CertificateCategory | undefined =
      request.type === 'CERTIFICATE' ? getRequestCertificateCategory(request) : undefined;
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

    const existingCredential = findCredentialForRequest(request);
    if (!credentialId && existingCredential) {
      credentialId = existingCredential.id;
      upsertCredentialState(existingCredential);
    }

    const stepUpToken = await requestStepUpToken({
      action: 'CREDENTIAL_ISSUE',
      targetId: credentialId || undefined,
      title: 'Confirm Credential Issuance',
      description: 'Enter the OTP sent to your email to issue this credential.',
    });

    let createdCredential: Credential | null = null;
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
      createdCredential = created;
      credentialId = created.id;
      upsertCredentialState(created);
      if (selectedFile) {
        uploadFileDuringIssue = undefined;
      }

    }

    const issued = await CredentialService.issue(credentialId, {
      description: request.description || undefined,
      issuedDate: new Date().toISOString(),
      metadata: requestMetadata,
      expiryDate,
      file: uploadFileDuringIssue,
    }, stepUpToken);
    upsertCredentialState(issued);
    if (issued.status !== 'ISSUED') {
      return {
        credentialId,
        status: issued.status,
        completed: false,
      };
    }

    if (request.deliveryMethod === 'DIGITAL') {
      await updateRequestStatus(
        request.id,
        'COMPLETED',
        undefined,
        `Credential issued by institution. Credential ID: ${credentialId}.`,
        credentialId,
      );
    } else {
      await updateRequestStatus(
        request.id,
        'APPROVED',
        undefined,
        `Digital credential issued for BOTH delivery. Awaiting physical claim.`,
        credentialId,
      );
    }

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

    return {
      credentialId,
      status: issued.status,
      completed: request.deliveryMethod === 'DIGITAL',
      createdCredential,
    };
  };

  const handleRequestAction = async (
    requestId: string,
    action: 'APPROVE' | 'REJECT' | 'ISSUE' | 'MARK_PHYSICAL_CLAIMED',
  ) => {
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
      if (action === 'MARK_PHYSICAL_CLAIMED') {
        await CredentialService.markPhysicalClaimed(requestId);
        setRequestsHint('Physical credential claim recorded. Request marked as completed.');
        createEvent('REQUEST', 'Physical claim recorded', `Request ${requestId} marked as physically claimed.`);
        await loadCredentials();
        return;
      }

      const request = requests.find(entry => entry.id === requestId);
      if (!request) {
        throw new Error('Credential request not found.');
      }

      setUpdatingRequestId(requestId);
      try {
        const result = await issueCredentialForRequest(request);
        if (result.completed) {
          setRequestsHint('Credential issued and request marked as completed.');
          createEvent(
            'REQUEST',
            'Credential issued',
            `Request ${requestId} completed with credential ${result.credentialId}.`,
          );
        } else {
          if (request.deliveryMethod === 'BOTH') {
            setRequestsHint('Digital credential issued for BOTH delivery. Mark physical claim after pickup.');
            createEvent(
              'REQUEST',
              'Digital credential issued',
              `Request ${requestId} issued digitally and remains approved until physical claim.`,
            );
          } else {
            setRequestsHint(`Request ${requestId} updated.`);
          }
        }
        await loadCredentials();
      } finally {
        setUpdatingRequestId(null);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'STEP_UP_CANCELLED' || error.message === 'STEP_UP_IN_PROGRESS')
      ) {
        return;
      }
      setRequestsError(getApiErrorMessage(error) || 'Unable to issue credential.');
      console.error('Failed handling request action:', error);
    }
  };

  const handleBulkRequestAction = async (action: 'APPROVE' | 'REJECT' | 'ISSUE') => {
    if (selectedRequestIds.length === 0) {
      setRequestsError('Select at least one request for bulk action.');
      return;
    }

    const results: Array<'fulfilled' | 'rejected'> = [];
    for (const requestId of selectedRequestIds) {
      try {
        if (action === 'APPROVE') {
          await updateRequestStatus(requestId, 'APPROVED');
          results.push('fulfilled');
          continue;
        }
        if (action === 'REJECT') {
          const reason = rejectionReasonByRequestId[requestId]?.trim() || 'Rejected during bulk review.';
          await updateRequestStatus(requestId, 'REJECTED', reason);
          results.push('fulfilled');
          continue;
        }
        const request = requests.find(entry => entry.id === requestId);
        if (!request) {
          throw new Error(`Credential request ${requestId} not found.`);
        }
        await issueCredentialForRequest(request);
        results.push('fulfilled');
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message === 'STEP_UP_CANCELLED' || error.message === 'STEP_UP_IN_PROGRESS')
        ) {
          results.push('rejected');
          continue;
        }
        results.push('rejected');
      }
    }

    const succeeded = results.filter(result => result === 'fulfilled').length;
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
      const stepUpToken = await requestStepUpToken({
        action: 'CREDENTIAL_ISSUE',
        title: 'Confirm Credential Issuance',
        description: 'Enter the OTP sent to your email to issue this credential.',
      });

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
      upsertCredentialState(created);

      const issued = await CredentialService.issue(created.id, {
        issuedDate: new Date().toISOString(),
        description: payload.description,
        expiryDate: normalizedExpiryDate,
        metadata: directIssueMetadata,
      }, stepUpToken);
      upsertCredentialState(issued);

      setRequestsHint('Credential issued successfully.');
      createEvent(
        'REQUEST',
        'Credential issued directly',
        `Credential ${issued.id} issued to student ${payload.studentId}.`,
      );

      await loadCredentials();
      return issued;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'STEP_UP_CANCELLED' || error.message === 'STEP_UP_IN_PROGRESS')
      ) {
        throw error;
      }
      const message = getApiErrorMessage(error) || 'Unable to issue credential directly.';
      throw new Error(message);
    }
  };

  const handleCredentialStatusUpdate = async (credentialId: string, status: CredentialStatus) => {
    setRequestsError(null);
    setRequestsHint(null);
    try {
      const updated = await CredentialService.updateStatus(credentialId, status);
      upsertCredentialState(updated);
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
      const stepUpToken = await requestStepUpToken({
        action: 'CREDENTIAL_ISSUE',
        targetId: credentialId,
        title: 'Confirm Credential Re-Issuance',
        description: 'Enter the OTP sent to your email to re-issue this credential.',
      });
      const issued = await CredentialService.issue(credentialId, {
        issuedDate: new Date().toISOString(),
        file,
      }, stepUpToken);
      upsertCredentialState(issued);
      setRequestsHint('Credential re-issued successfully.');
      createEvent('REQUEST', 'Credential re-issued', `Credential ${credentialId} re-issued.`);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'STEP_UP_CANCELLED' || error.message === 'STEP_UP_IN_PROGRESS')
      ) {
        throw error;
      }
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

  const loadAuditLogs = useCallback(async () => {
    setIsLoadingAuditLogs(true);
    try {
      const data = await AuditService.list();
      setAuditLogs(data);
      setHasLoadedAuditLogs(true);
    } catch (error) {
      setAuditLogs([]);
      setRequestsError(getApiErrorMessage(error) || 'Unable to load audit logs.');
    } finally {
      setIsLoadingAuditLogs(false);
    }
  }, []);

  const institutionAuditActionOptions = useMemo(
    () =>
      ['ALL', ...Array.from(new Set(auditLogs.map(log => log.action))).sort()] as Array<
        'ALL' | AuditAction
      >,
    [auditLogs],
  );

  const filteredInstitutionAuditLogs = useMemo(
    () =>
      auditLogs.filter(log => {
        if (auditActionFilter !== 'ALL' && log.action !== auditActionFilter) return false;
        if (auditSeverityFilter !== 'ALL' && log.severity !== auditSeverityFilter) return false;
        return true;
      }),
    [auditActionFilter, auditLogs, auditSeverityFilter],
  );

  const totalInstitutionAuditPages = Math.max(
    1,
    Math.ceil(filteredInstitutionAuditLogs.length / auditPageSize),
  );
  const currentInstitutionAuditPage = Math.min(auditPage, totalInstitutionAuditPages);
  const pagedInstitutionAuditLogs = useMemo(() => {
    const start = (currentInstitutionAuditPage - 1) * auditPageSize;
    return filteredInstitutionAuditLogs.slice(start, start + auditPageSize);
  }, [auditPageSize, currentInstitutionAuditPage, filteredInstitutionAuditLogs]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditActionFilter, auditSeverityFilter, auditPageSize]);

  useEffect(() => {
    if (section !== 'logs' || hasLoadedAuditLogs) return;
    void loadAuditLogs();
  }, [hasLoadedAuditLogs, loadAuditLogs, section]);

  const scheduleRefresh = useCallback((key: 'students' | 'requests' | 'credentials' | 'logs') => {
    if (refreshTimersRef.current[key]) return;
    refreshTimersRef.current[key] = window.setTimeout(() => {
      refreshTimersRef.current[key] = null;
      if (key === 'students' && section === 'students') {
        void loadStudents();
      }
      if (key === 'students' && (section === 'overview' || section === 'analytics')) {
        void loadStudents();
      }
      if (key === 'requests' && (section === 'requests' || section === 'issue' || section === 'overview' || section === 'analytics')) {
        void loadRequests();
      }
      if (key === 'credentials' && (section === 'issue' || section === 'overview' || section === 'analytics')) {
        void loadCredentials();
      }
      if (key === 'logs' && section === 'logs') {
        void loadAuditLogs();
      }
    }, 350);
  }, [loadAuditLogs, loadCredentials, loadRequests, loadStudents, section]);

  useEffect(() => {
    const unsubscribe = realtimeService.subscribe(event => {
      if (event.domain === 'users') {
        scheduleRefresh('students');
      }
      if (event.domain === 'credentialRequests') {
        scheduleRefresh('requests');
      }
      if (event.domain === 'credentials') {
        scheduleRefresh('credentials');
      }
      if (event.domain === 'audit') {
        scheduleRefresh('logs');
      }
    });

    return () => {
      unsubscribe();
      (Object.keys(refreshTimersRef.current) as Array<'students' | 'requests' | 'credentials' | 'logs'>).forEach(key => {
        const timer = refreshTimersRef.current[key];
        if (timer) {
          window.clearTimeout(timer);
          refreshTimersRef.current[key] = null;
        }
      });
    };
  }, [scheduleRefresh]);

  return (
    <div className="space-y-6">
      {section === 'overview' && (
        <InstitutionOverviewSection
          students={students}
          requests={requests}
          credentials={credentials}
          isLoadingStudents={isLoadingStudents}
          isLoadingRequests={isLoadingRequests}
          isLoadingCredentials={isLoadingCredentials}
        />
      )}

      {section === 'analytics' && (
        <InstitutionAnalyticsSection
          students={students}
          requests={requests}
          credentials={credentials}
          isLoadingStudents={isLoadingStudents}
          isLoadingRequests={isLoadingRequests}
          isLoadingCredentials={isLoadingCredentials}
        />
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
          onIssueFileChange={(requestId: string, file: File | null) => {
            setIssueFileByRequestId(previous => ({ ...previous, [requestId]: file }));
          }}
          onIssueExpiryChange={(requestId: string, expiryDate: string) => {
            setIssueExpiryByRequestId(previous => ({ ...previous, [requestId]: expiryDate }));
          }}
          onRequestAction={handleRequestAction}
          onBulkAction={handleBulkRequestAction}
        />
      )}

      {section === 'receipt-verify' && (
        <InstitutionReceiptVerifySection />
      )}

      {section === 'issue' && (
        <InstitutionIssueSection
          students={students}
          credentials={credentials}
          isLoadingCredentials={isLoadingCredentials}
          requests={requests}
          isLoadingRequests={isLoadingRequests}
          updatingRequestId={updatingRequestId}
          onDirectIssue={handleDirectIssueCredential}
          onCredentialStatusUpdate={handleCredentialStatusUpdate}
          onCredentialReissue={handleCredentialReissue}
          issueFileByRequestId={issueFileByRequestId}
          issueExpiryByRequestId={issueExpiryByRequestId}
          onIssueFileChange={(requestId: string, file: File | null) => {
            setIssueFileByRequestId(previous => ({ ...previous, [requestId]: file }));
          }}
          onIssueExpiryChange={(requestId: string, expiryDate: string) => {
            setIssueExpiryByRequestId(previous => ({ ...previous, [requestId]: expiryDate }));
          }}
          onRequestAction={handleRequestAction}
          onViewCredentialDetails={(credentialId: string) => {
            setSelectedCredentialId(credentialId);
            setIsCredentialDrawerOpen(true);
          }}
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

      {section === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Institution Audit Logs</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Action</label>
              <select
                value={auditActionFilter}
                onChange={event => setAuditActionFilter(event.target.value as 'ALL' | AuditAction)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              >
                {institutionAuditActionOptions.map(action => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Severity</label>
              <select
                value={auditSeverityFilter}
                onChange={event => setAuditSeverityFilter(event.target.value as 'ALL' | AuditSeverity)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              >
                {(['ALL', 'INFO', 'WARNING', 'CRITICAL'] as const).map(severity => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Page Size</label>
              <select
                value={auditPageSize}
                onChange={event => setAuditPageSize(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              >
                {[10, 20, 50].map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {filteredInstitutionAuditLogs.length} entries
              </div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoadingAuditLogs && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                      Loading audit logs...
                    </td>
                  </tr>
                )}
                {!isLoadingAuditLogs && filteredInstitutionAuditLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                      No audit logs found for institution scope.
                    </td>
                  </tr>
                )}
                {!isLoadingAuditLogs &&
                  pagedInstitutionAuditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-xs text-slate-600">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-800">{log.action}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{log.severity}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{log.actorEmail || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{log.description || '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!isLoadingAuditLogs && filteredInstitutionAuditLogs.length > 0 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Page {currentInstitutionAuditPage} of {totalInstitutionAuditPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAuditPage(previous => Math.max(1, previous - 1))}
                  disabled={currentInstitutionAuditPage <= 1}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setAuditPage(previous => Math.min(totalInstitutionAuditPages, previous + 1))
                  }
                  disabled={currentInstitutionAuditPage >= totalInstitutionAuditPages}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {stepUpModal}
      <InstitutionCredentialDetailsDrawer
        credentialId={selectedCredentialId}
        isOpen={isCredentialDrawerOpen}
        onClose={() => setIsCredentialDrawerOpen(false)}
        onExited={() => setSelectedCredentialId(null)}
      />
    </div>
  );
}
