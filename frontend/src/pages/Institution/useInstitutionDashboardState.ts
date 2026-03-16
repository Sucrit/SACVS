import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { AppNotification, NotificationService } from '../../services/notification.service';
import {
  ActivityEvent,
  DEFAULT_STUDENT_FORM,
  InstitutionSection,
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
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useToast } from '../../hooks/useToast';
import { useSearchParamsState } from '../../hooks/useSearchParamsState';

// --- Helpers (module-level, not exported) ---

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

// =============================================================================
// Hook
// =============================================================================

export interface InstitutionDashboardState {
  section: InstitutionSection;

  // Students
  students: User[];
  filteredStudents: User[];
  isLoadingStudents: boolean;
  studentSearch: string;
  setStudentSearch: (v: string) => void;
  studentStatusFilter: StudentStatusFilter;
  setStudentStatusFilter: (v: StudentStatusFilter) => void;
  studentDepartmentFilter: string;
  setStudentDepartmentFilter: (v: string) => void;
  departmentOptions: string[];
  studentForm: StudentFormState;
  setStudentFormValue: (field: keyof StudentFormState, value: string) => void;
  isSubmittingStudent: boolean;
  isBulkImporting: boolean;
  updatingStudentId: string | null;
  editingStudentId: string | null;
  editStudentForm: StudentFormState;
  setEditStudentFormValue: (field: keyof StudentFormState, value: string) => void;
  handleCreateStudent: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleBulkCsvUpload: (fileOrEvent: File | ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleStudentStatusUpdate: (studentId: string, status: UserStatus) => Promise<void>;
  handleStartEditStudent: (student: User) => void;
  handleSaveEditedStudent: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleCancelEditStudent: () => void;
  handleRemoveStudent: (student: User) => Promise<void>;
  studentCounts: { total: number; pending: number; approved: number; rejected: number; suspended: number };

  // Requests
  requests: CredentialRequest[];
  filteredRequests: CredentialRequest[];
  isLoadingRequests: boolean;
  requestSearch: string;
  setRequestSearch: (v: string) => void;
  requestStatusFilter: RequestStatusFilter;
  setRequestStatusFilter: (v: RequestStatusFilter) => void;
  selectedRequestIds: string[];
  setSelectedRequestIds: React.Dispatch<React.SetStateAction<string[]>>;
  rejectionReasonByRequestId: Record<string, string>;
  setRejectionReasonByRequestId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  issueFileByRequestId: Record<string, File | null>;
  setIssueFileByRequestId: React.Dispatch<React.SetStateAction<Record<string, File | null>>>;
  issueExpiryByRequestId: Record<string, string>;
  setIssueExpiryByRequestId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updatingRequestId: string | null;
  handleRequestAction: (requestId: string, action: 'APPROVE' | 'REJECT' | 'ISSUE' | 'MARK_PHYSICAL_CLAIMED') => Promise<void>;
  handleBulkRequestAction: (action: 'APPROVE' | 'REJECT') => Promise<void>;
  pendingCount: number;

  // Credentials
  credentials: Credential[];
  isLoadingCredentials: boolean;
  handleDirectIssueCredential: (payload: {
    studentId: string;
    type: CredentialType;
    title: string;
    description?: string;
    expiryDate?: string;
    certificateCategory?: CertificateCategory;
    file: File;
  }) => Promise<Credential>;
  handleCredentialStatusUpdate: (credentialId: string, status: CredentialStatus) => Promise<void>;
  handleCredentialReissue: (credentialId: string, file?: File) => Promise<void>;
  selectedCredentialId: string | null;
  setSelectedCredentialId: (v: string | null) => void;
  isCredentialDrawerOpen: boolean;
  setIsCredentialDrawerOpen: (v: boolean) => void;

  // Notifications
  outboundNotifications: OutboundNotification[];
  inboundNotifications: AppNotification[];
  isLoadingInboundNotifications: boolean;
  isMarkingAllNotificationsRead: boolean;
  handleMarkNotificationRead: (notificationId: string) => Promise<void>;
  handleMarkAllNotificationsRead: () => Promise<void>;
  notificationTarget: NotificationTarget;
  notificationTitle: string;
  notificationMessage: string;
  isSubmittingNotification: boolean;
  setNotificationTarget: (v: NotificationTarget) => void;
  setNotificationTitle: (v: string) => void;
  setNotificationMessage: (v: string) => void;
  handleNotificationSubmit: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
  requestDetailsFromQueryId: string | null;
  setRequestDetailsFromQueryId: (id: string | null) => void;

  // Audit logs
  auditLogs: AuditLogEntry[];
  isLoadingAuditLogs: boolean;
  auditActionFilter: 'ALL' | AuditAction;
  setAuditActionFilter: (v: 'ALL' | AuditAction) => void;
  auditSeverityFilter: 'ALL' | AuditSeverity;
  setAuditSeverityFilter: (v: 'ALL' | AuditSeverity) => void;
  auditPage: number;
  setAuditPage: React.Dispatch<React.SetStateAction<number>>;
  auditPageSize: number;
  setAuditPageSize: (v: number) => void;
  institutionAuditActionOptions: Array<'ALL' | AuditAction>;
  filteredInstitutionAuditLogs: AuditLogEntry[];
  totalInstitutionAuditPages: number;
  currentInstitutionAuditPage: number;
  pagedInstitutionAuditLogs: AuditLogEntry[];

  // Step-up modal
  stepUpModal: React.ReactNode;

  // Navigation
  navigate: ReturnType<typeof useNavigate>;
}

export function useInstitutionDashboardState(): InstitutionDashboardState {
  const location = useLocation();
  const navigate = useNavigate();
  const section = getInstitutionSection(location.pathname);
  const isIssueSection = section === 'issue' || section === 'issue-awaiting' || section === 'issue-manage';

  // --- Requests state ---
  const [requests, setRequests] = useState<CredentialRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [hasLoadedRequests, setHasLoadedRequests] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [requestsHint, setRequestsHint] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [requestSearch, setRequestSearch] = useSearchParamsState('rq', '');
  const [requestStatusFilter, setRequestStatusFilter] = useSearchParamsState<RequestStatusFilter>('rs', 'ALL');
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [rejectionReasonByRequestId, setRejectionReasonByRequestId] = useState<Record<string, string>>({});
  const [issueFileByRequestId, setIssueFileByRequestId] = useState<Record<string, File | null>>({});
  const [issueExpiryByRequestId, setIssueExpiryByRequestId] = useState<Record<string, string>>({});
  const [requestDetailsFromQueryId, setRequestDetailsFromQueryId] = useState<string | null>(null);

  // --- Credentials state ---
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(true);
  const [hasLoadedCredentials, setHasLoadedCredentials] = useState(false);

  // --- Audit logs state ---
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [hasLoadedAuditLogs, setHasLoadedAuditLogs] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useSearchParamsState<'ALL' | AuditAction>('aa', 'ALL');
  const [auditSeverityFilter, setAuditSeverityFilter] = useSearchParamsState<'ALL' | AuditSeverity>('as', 'ALL');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(20);

  // --- Students state ---
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
  const [studentSearch, setStudentSearch] = useSearchParamsState('sq', '');
  const [studentStatusFilter, setStudentStatusFilter] = useSearchParamsState<StudentStatusFilter>('ss', 'ALL');
  const [studentDepartmentFilter, setStudentDepartmentFilter] = useSearchParamsState('sd', 'ALL');
  const [studentForm, setStudentForm] = useState<StudentFormState>(DEFAULT_STUDENT_FORM);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editStudentForm, setEditStudentForm] = useState<StudentFormState>(DEFAULT_STUDENT_FORM);
  const [editStudentError, setEditStudentError] = useState<string | null>(null);
  const [editStudentHint, setEditStudentHint] = useState<string | null>(null);

  // --- Notifications state ---
  const [, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [outboundNotifications, setOutboundNotifications] = useState<OutboundNotification[]>([]);
  const [inboundNotifications, setInboundNotifications] = useState<AppNotification[]>([]);
  const [isLoadingInboundNotifications, setIsLoadingInboundNotifications] = useState(false);
  const [isMarkingAllNotificationsRead, setIsMarkingAllNotificationsRead] = useState(false);
  const [hasLoadedInboundNotifications, setHasLoadedInboundNotifications] = useState(false);
  const [notificationTarget, setNotificationTarget] = useState<NotificationTarget>('ALL');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [notificationHint, setNotificationHint] = useState<string | null>(null);
  const [isSubmittingNotification, setIsSubmittingNotification] = useState(false);
  const [hasLoadedNotifications, setHasLoadedNotifications] = useState(false);

  // --- Credential drawer ---
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null);
  const [isCredentialDrawerOpen, setIsCredentialDrawerOpen] = useState(false);

  // --- External hooks ---
  const { requestStepUpToken, stepUpModal } = useStepUp();
  const { showToast } = useToast();
  const hasInitializedRef = useRef(false);

  // --- Activity event helper ---
  const createEvent = useCallback((type: ActivityEvent['type'], title: string, description: string) => {
    setActivityEvents(previous => [{ id: createClientId(), type, title, description, createdAt: new Date().toISOString() }, ...previous].slice(0, 100));
  }, []);

  // --- Toast bridge for error/hint states ---
  useEffect(() => { if (requestsError) showToast({ variant: 'error', message: requestsError }); }, [requestsError, showToast]);
  useEffect(() => { if (requestsHint) showToast({ variant: 'success', message: requestsHint }); }, [requestsHint, showToast]);
  useEffect(() => {
    if (studentsError || createStudentError || editStudentError) {
      showToast({ variant: 'error', message: studentsError || createStudentError || editStudentError || 'Unable to process student action.' });
    }
  }, [createStudentError, editStudentError, showToast, studentsError]);
  useEffect(() => {
    if (studentsHint || createStudentHint || editStudentHint) {
      showToast({ variant: 'success', message: studentsHint || createStudentHint || editStudentHint || 'Student action completed successfully.' });
    }
  }, [createStudentHint, editStudentHint, showToast, studentsHint]);
  useEffect(() => { if (notificationError) showToast({ variant: 'error', message: notificationError }); }, [notificationError, showToast]);
  useEffect(() => { if (notificationHint) showToast({ variant: 'info', message: notificationHint }); }, [notificationHint, showToast]);

  // --- Data loaders ---

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

  const loadOutboundNotifications = useCallback(async () => {
    setNotificationError(null);
    try {
      const items = await NotificationService.listInstitutionBroadcasts();
      setOutboundNotifications(items);
      setHasLoadedNotifications(true);
    } catch (error) {
      setOutboundNotifications([]);
      setNotificationError(getApiErrorMessage(error) || 'Unable to load notification activity.');
      console.error('Failed to load institution notifications:', error);
    }
  }, []);

  const loadInboundNotifications = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setIsLoadingInboundNotifications(true);
    try {
      const data = await NotificationService.list({ page: 1, pageSize: 100 });
      setInboundNotifications(data.items);
      setHasLoadedInboundNotifications(true);
    } catch (error) {
      console.error('Failed to load inbound notifications:', error);
      if (!silent) {
        setInboundNotifications([]);
        setNotificationError('Unable to load received notifications.');
      }
    } finally {
      if (!silent) setIsLoadingInboundNotifications(false);
    }
  }, []);

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

  // --- Section-based lazy loading ---

  useEffect(() => {
    if ((section === 'overview' || section === 'analytics' || section === 'reports')) {
      if (!hasLoadedRequests) void loadRequests();
      if (!hasLoadedStudents) void loadStudents();
      if (!hasLoadedCredentials) void loadCredentials();
    }
    if (section === 'students' && !hasLoadedStudents) void loadStudents();
    if (section === 'notifications') {
      if (!hasLoadedNotifications) void loadOutboundNotifications();
      if (!hasLoadedInboundNotifications) void loadInboundNotifications();
      if (!hasLoadedRequests) void loadRequests();
      if (!hasLoadedStudents) void loadStudents();
    }
    if (section === 'requests') {
      if (!hasLoadedRequests) void loadRequests();
      if (!hasLoadedStudents) void loadStudents();
    }
    if (isIssueSection) {
      if (!hasLoadedRequests) void loadRequests();
      if (!hasLoadedStudents) void loadStudents();
      if (!hasLoadedCredentials) void loadCredentials();
    }
    if (!hasInitializedRef.current) {
      createEvent('SYSTEM', 'Institution workspace initialized', 'Institution frontend sections loaded.');
      hasInitializedRef.current = true;
    }
  }, [createEvent, hasLoadedCredentials, hasLoadedNotifications, hasLoadedInboundNotifications, hasLoadedRequests, hasLoadedStudents, isIssueSection, loadOutboundNotifications, loadInboundNotifications, loadCredentials, loadRequests, loadStudents, section]);

  useEffect(() => {
    if (section !== 'logs' || hasLoadedAuditLogs) return;
    void loadAuditLogs();
  }, [hasLoadedAuditLogs, loadAuditLogs, section]);

  useEffect(() => {
    if (section !== 'requests') return;

    const params = new URLSearchParams(location.search);
    const requestId = params.get('requestId');
    if (!requestId || isLoadingRequests) return;

    let isCancelled = false;

    const openRequestDetailsFromQuery = async () => {
      let targetRequestId: string | null = requests.find(request => request.id === requestId)?.id ?? null;

      if (!targetRequestId) {
        try {
          const fetched = await CredentialService.getRequestById(requestId);
          if (!isCancelled && fetched) {
            targetRequestId = fetched.id;
            setRequests(previous => {
              if (previous.some(request => request.id === fetched.id)) return previous;
              return [fetched, ...previous];
            });
          }
        } catch (error) {
          console.error('Failed to fetch institution request from notification deep-link:', error);
        }
      }

      if (!isCancelled && targetRequestId) {
        setRequestDetailsFromQueryId(targetRequestId);
      }

      if (!isCancelled) {
        params.delete('requestId');
        const nextSearch = params.toString();
        navigate(
          {
            pathname: '/institution/requests',
            search: nextSearch ? `?${nextSearch}` : '',
          },
          { replace: true },
        );
      }
    };

    void openRequestDetailsFromQuery();
    return () => {
      isCancelled = true;
    };
  }, [isLoadingRequests, location.search, navigate, requests, section]);

  useEffect(() => {
    if (section !== 'issue-manage') return;

    const params = new URLSearchParams(location.search);
    const credentialId = params.get('credentialId');
    if (!credentialId) return;

    setSelectedCredentialId(credentialId);
    setIsCredentialDrawerOpen(true);

    params.delete('credentialId');
    const nextSearch = params.toString();
    navigate(
      {
        pathname: '/institution/issue/manage',
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );
  }, [location.search, navigate, section]);

  // --- Realtime sync ---

    const realtimeRefreshMap = useMemo(() => ({
    users: () => {
      if (section === 'students' || section === 'overview' || section === 'analytics' || section === 'reports') void loadStudents();
    },
    credentialRequests: () => {
      if (section === 'requests' || section === 'issue' || section === 'overview' || section === 'analytics' || section === 'reports') void loadRequests();
    },
    credentials: () => {
      if (section === 'issue' || section === 'overview' || section === 'analytics' || section === 'reports') void loadCredentials();
    },
    notifications: () => {
      if (section === 'notifications') void loadInboundNotifications({ silent: true });
    },
    audit: () => {
      if (section === 'logs') void loadAuditLogs();
    },
  }), [loadAuditLogs, loadCredentials, loadInboundNotifications, loadRequests, loadStudents, section]);

  useRealtimeSync(realtimeRefreshMap);

  // --- Computed / memoized ---

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

  const studentCounts = useMemo(() => ({
    total: students.length,
    pending: students.filter(s => s.status === 'PENDING').length,
    approved: students.filter(s => s.status === 'APPROVED').length,
    rejected: students.filter(s => s.status === 'REJECTED').length,
    suspended: students.filter(s => s.status === 'SUSPENDED').length,
  }), [students]);

  const departmentOptions = useMemo(() => {
    const values = new Set<string>();
    students.forEach(s => { if (s.profile?.department) values.add(s.profile.department); });
    return ['ALL', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [students]);

  const filteredStudents = useMemo(() => {
    const keyword = studentSearch.trim().toLowerCase();
    return students.filter(student => {
      if (studentStatusFilter !== 'ALL' && student.status !== studentStatusFilter) return false;
      if (studentDepartmentFilter !== 'ALL' && student.profile?.department !== studentDepartmentFilter) return false;
      if (!keyword) return true;
      const searchable = [student.firstName, student.middleName || '', student.lastName, student.email, student.profile?.studentNumber || '', student.profile?.department || ''].join(' ').toLowerCase();
      return searchable.includes(keyword);
    });
  }, [studentDepartmentFilter, studentSearch, studentStatusFilter, students]);

  const filteredRequests = useMemo(() => {
    const studentById = new Map(students.map(s => [s.id, s] as const));
    const keyword = requestSearch.trim().toLowerCase();
    return requests.filter(request => {
      if (requestStatusFilter !== 'ALL' && request.status !== requestStatusFilter) return false;
      if (!keyword) return true;
      const student = studentById.get(request.studentId);
      const studentName = student ? [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ') : '';
      const studentNumber = student?.profile?.studentNumber || '';
      const searchable = [request.id, request.title, request.type, request.status, request.rejectionReason || '', studentName, studentNumber].join(' ').toLowerCase();
      return searchable.includes(keyword);
    });
  }, [requestSearch, requestStatusFilter, requests, students]);

  const institutionAuditActionOptions = useMemo(
    () => ['ALL', ...Array.from(new Set(auditLogs.map(log => log.action))).sort()] as Array<'ALL' | AuditAction>,
    [auditLogs],
  );

  const filteredInstitutionAuditLogs = useMemo(
    () => auditLogs.filter(log => {
      if (auditActionFilter !== 'ALL' && log.action !== auditActionFilter) return false;
      if (auditSeverityFilter !== 'ALL' && log.severity !== auditSeverityFilter) return false;
      return true;
    }),
    [auditActionFilter, auditLogs, auditSeverityFilter],
  );

  const totalInstitutionAuditPages = Math.max(1, Math.ceil(filteredInstitutionAuditLogs.length / auditPageSize));
  const currentInstitutionAuditPage = Math.min(auditPage, totalInstitutionAuditPages);
  const pagedInstitutionAuditLogs = useMemo(() => {
    const start = (currentInstitutionAuditPage - 1) * auditPageSize;
    return filteredInstitutionAuditLogs.slice(start, start + auditPageSize);
  }, [auditPageSize, currentInstitutionAuditPage, filteredInstitutionAuditLogs]);

  useEffect(() => { setAuditPage(1); }, [auditActionFilter, auditSeverityFilter, auditPageSize]);

  // --- Form helpers ---

  const setStudentFormValue = (field: keyof StudentFormState, value: string) => {
    setStudentForm(previous => ({ ...previous, [field]: value }));
  };

  const setEditStudentFormValue = (field: keyof StudentFormState, value: string) => {
    setEditStudentForm(previous => ({ ...previous, [field]: value }));
  };

  // --- Credential helpers ---

  const upsertCredentialState = useCallback((updated: Credential) => {
    setCredentials(previous =>
      previous.some(item => item.id === updated.id)
        ? previous.map(item => (item.id === updated.id ? updated : item))
        : [updated, ...previous],
    );
  }, []);

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
        return data.source === 'CREDENTIAL_REQUEST' && data.requestId === request.id && entry.studentId === request.studentId && entry.type === request.type;
      });
      return matched ?? null;
    },
    [credentials],
  );

  // --- Request status updates ---

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
      const updated = await CredentialService.updateRequestStatus(requestId, status, rejectionReason, notes, credentialId);
      setRequests(previous => previous.map(r => (r.id === requestId ? { ...r, ...updated } : r)));
      return updated;
    } finally {
      setUpdatingRequestId(null);
    }
  };

  // --- Credential issuance for a request ---

  const issueCredentialForRequest = async (request: CredentialRequest) => {
    if (request.deliveryMethod === 'PHYSICAL') throw new Error('Digital issuance is blocked for PHYSICAL delivery requests.');

    let credentialId = request.credentialId;
    const selectedFile = issueFileByRequestId[request.id] ?? undefined;
    let uploadFileDuringIssue = selectedFile;
    const certificateCategory: CertificateCategory | undefined = request.type === 'CERTIFICATE' ? getRequestCertificateCategory(request) : undefined;
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
      if (selectedFile) uploadFileDuringIssue = undefined;
    }

    const issued = await CredentialService.issue(credentialId, {
      description: request.description || undefined,
      issuedDate: new Date().toISOString(),
      metadata: requestMetadata,
      expiryDate,
      file: uploadFileDuringIssue,
    }, stepUpToken);
    upsertCredentialState(issued);
    if (issued.status !== 'ISSUED') return { credentialId, status: issued.status, completed: false };

    if (request.deliveryMethod === 'DIGITAL') {
      await updateRequestStatus(request.id, 'COMPLETED', undefined, `Credential issued by institution. Credential ID: ${credentialId}.`, credentialId);
    } else {
      await updateRequestStatus(request.id, 'APPROVED', undefined, `Digital credential issued for BOTH delivery. Awaiting physical claim.`, credentialId);
    }

    setRequests(previous => previous.map(entry => (entry.id === request.id ? { ...entry, credentialId } : entry)));
    setIssueFileByRequestId(previous => { const next = { ...previous }; delete next[request.id]; return next; });
    setIssueExpiryByRequestId(previous => { const next = { ...previous }; delete next[request.id]; return next; });

    return { credentialId, status: issued.status, completed: request.deliveryMethod === 'DIGITAL', createdCredential };
  };

  // --- Student handlers ---

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

  const handleBulkCsvUpload = async (fileOrEvent: File | ChangeEvent<HTMLInputElement>) => {
    const file = fileOrEvent instanceof File ? fileOrEvent : fileOrEvent.target.files?.[0];
    if (!file) return;
    setStudentsError(null);
    setStudentsHint(null);
    setIsBulkImporting(true);
    try {
      const parsed = parseCsvStudents(await file.text());
      if (parsed.error) { setStudentsError(parsed.error); return; }
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
      if (error instanceof Error && (error.message === 'STEP_UP_CANCELLED' || error.message === 'STEP_UP_IN_PROGRESS')) return;
      setStudentsError('Unable to import students from CSV.');
      console.error('Failed bulk importing students:', error);
    } finally {
      setIsBulkImporting(false);
      if (!(fileOrEvent instanceof File)) {
        fileOrEvent.target.value = '';
      }
    }
  };

  const handleStudentStatusUpdate = async (studentId: string, status: UserStatus) => {
    setUpdatingStudentId(studentId);
    setStudentsError(null);
    setStudentsHint(null);
    try {
      const updated = await UserService.updateInstitutionStudentStatus(studentId, status);
      setStudents(previous => previous.map(s => (s.id === studentId ? { ...s, ...updated } : s)));
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
      setStudents(previous => previous.map(s => (s.id === updated.id ? updated : s)));
      setEditStudentHint('Student profile updated successfully.');
      createEvent('STUDENT', 'Student profile updated', `${updated.email} was updated.`);
      setEditingStudentId(null);
    } catch (error) {
      setEditStudentError(getApiErrorMessage(error) || 'Unable to update student profile.');
      console.error('Failed updating student profile:', error);
    }
  };

  const handleRemoveStudent = async (student: User) => {
    if (!window.confirm(`Delete ${student.email}?\n\nThis will delete permanently delete the student account from the system and cannot be undone.`)) return;
    setStudentsError(null);
    setStudentsHint(null);
    try {
      const result = await UserService.deleteInstitutionStudent(student.id);
      setStudents(previous => previous.filter(entry => entry.id !== student.id));
      setStudentsHint(result.message || `Deleted ${student.email}.`);
      createEvent('SECURITY', 'Student account deleted', `${student.email} was deleted from DB and Clerk.`);
      if (editingStudentId === student.id) handleCancelEditStudent();
    } catch (error) {
      setStudentsError(getApiErrorMessage(error) || 'Unable to delete student account.');
      console.error('Failed deleting student account:', error);
    }
  };

  // --- Request handlers ---

  const handleRequestAction = async (requestId: string, action: 'APPROVE' | 'REJECT' | 'ISSUE' | 'MARK_PHYSICAL_CLAIMED') => {
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
      if (!request) throw new Error('Credential request not found.');

      setUpdatingRequestId(requestId);
      try {
        const result = await issueCredentialForRequest(request);
        if (result.completed) {
          setRequestsHint('Credential issued and request marked as completed.');
          createEvent('REQUEST', 'Credential issued', `Request ${requestId} completed with credential ${result.credentialId}.`);
        } else {
          if (request.deliveryMethod === 'BOTH') {
            setRequestsHint('Digital credential issued for BOTH delivery. Mark physical claim after pickup.');
            createEvent('REQUEST', 'Digital credential issued', `Request ${requestId} issued digitally and remains approved until physical claim.`);
          } else {
            setRequestsHint(`Request ${requestId} updated.`);
          }
        }
        await loadCredentials();
      } finally {
        setUpdatingRequestId(null);
      }
    } catch (error) {
      if (error instanceof Error && (error.message === 'STEP_UP_CANCELLED' || error.message === 'STEP_UP_IN_PROGRESS')) return;
      setRequestsError(getApiErrorMessage(error) || 'Unable to issue credential.');
      console.error('Failed handling request action:', error);
    }
  };

  const handleBulkRequestAction = async (action: 'APPROVE' | 'REJECT') => {
    if (selectedRequestIds.length === 0) { setRequestsError('Select at least one request for bulk action.'); return; }
    const results: Array<'fulfilled' | 'rejected'> = [];
    for (const requestId of selectedRequestIds) {
      try {
        if (action === 'APPROVE') { await updateRequestStatus(requestId, 'APPROVED'); results.push('fulfilled'); continue; }
        if (action === 'REJECT') {
          const reason = rejectionReasonByRequestId[requestId]?.trim() || 'Rejected during bulk review.';
          await updateRequestStatus(requestId, 'REJECTED', reason);
          results.push('fulfilled');
          continue;
        }
      } catch (error) {
        if (error instanceof Error && (error.message === 'STEP_UP_CANCELLED' || error.message === 'STEP_UP_IN_PROGRESS')) { results.push('rejected'); continue; }
        results.push('rejected');
      }
    }
    const succeeded = results.filter(r => r === 'fulfilled').length;
    const failed = results.length - succeeded;
    setSelectedRequestIds([]);
    setRequestsHint(`Bulk ${action.toLowerCase()} complete: ${succeeded} updated, ${failed} failed.`);
    createEvent('REQUEST', 'Bulk request processing', `${action} applied to ${results.length} requests; ${succeeded} succeeded.`);
    await loadCredentials();
  };

  // --- Credential handlers ---

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
      const certificateCategory: CertificateCategory | undefined = payload.type === 'CERTIFICATE' ? payload.certificateCategory || DEFAULT_CERTIFICATE_CATEGORY : undefined;
      const normalizedExpiryDate = supportsExpiryDate(payload.type) ? toIsoDateFromInput(payload.expiryDate || '') : undefined;
      if (requiresExpiryDate(payload.type, certificateCategory || DEFAULT_CERTIFICATE_CATEGORY) && !normalizedExpiryDate) {
        throw new Error('Expiry date is required for license and professional certificate credentials.');
      }
      const directIssueMetadata = { source: 'INSTITUTION_DIRECT_ISSUE', ...(certificateCategory ? { certificateCategory } : {}) };

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
      createEvent('REQUEST', 'Credential issued directly', `Credential ${issued.id} issued to student ${payload.studentId}.`);
      await loadCredentials();
      return issued;
    } catch (error) {
      if (error instanceof Error && (error.message === 'STEP_UP_CANCELLED' || error.message === 'STEP_UP_IN_PROGRESS')) throw error;
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
      const issued = await CredentialService.issue(credentialId, { issuedDate: new Date().toISOString(), file }, stepUpToken);
      upsertCredentialState(issued);
      setRequestsHint('Credential re-issued successfully.');
      createEvent('REQUEST', 'Credential re-issued', `Credential ${credentialId} re-issued.`);
    } catch (error) {
      if (error instanceof Error && (error.message === 'STEP_UP_CANCELLED' || error.message === 'STEP_UP_IN_PROGRESS')) throw error;
      setRequestsError(getApiErrorMessage(error) || 'Unable to re-issue credential.');
      throw error;
    }
  };

  // --- Notification handler ---

  const handleNotificationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotificationError(null);
    setNotificationHint(null);
    if (!notificationTitle.trim()) { setNotificationError('Notification title is required.'); return false; }
    if (!notificationMessage.trim()) { setNotificationError('Notification message is required.'); return false; }

    setIsSubmittingNotification(true);
    try {
      const entry = await NotificationService.createInstitutionBroadcast({
        target: notificationTarget,
        title: notificationTitle.trim(),
        message: notificationMessage.trim(),
      });
      setOutboundNotifications(previous => [entry, ...previous]);
      setNotificationTitle('');
      setNotificationMessage('');
      setNotificationHint(
        entry.recipientCount > 0
          ? `Notification sent to ${entry.recipientCount} student${entry.recipientCount === 1 ? '' : 's'}.`
          : 'Notification saved, but no matching student recipients were found.',
      );
      createEvent('NOTIFICATION', 'Notification sent', `${entry.target}: ${entry.title}`);
      return true;
    } catch (error) {
      setNotificationError(getApiErrorMessage(error) || 'Unable to send notification.');
      console.error('Failed to send institution notification:', error);
      return false;
    } finally {
      setIsSubmittingNotification(false);
    }
  };

  const handleMarkNotificationRead = useCallback(async (notificationId: string) => {
    try {
      const updated = await NotificationService.markRead(notificationId, true);
      setInboundNotifications(previous => previous.map(n => (n.id === updated.id ? updated : n)));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, []);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    if (isMarkingAllNotificationsRead || inboundNotifications.every(n => n.read)) return;
    setIsMarkingAllNotificationsRead(true);
    try {
      await NotificationService.markAllRead();
      setInboundNotifications(previous => previous.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      showToast({ variant: 'error', message: 'Unable to mark notifications as read.' });
    } finally {
      setIsMarkingAllNotificationsRead(false);
    }
  }, [inboundNotifications, isMarkingAllNotificationsRead, showToast]);

  // --- Return ---

  return {
    section,
    students,
    filteredStudents,
    isLoadingStudents,
    studentSearch,
    setStudentSearch,
    studentStatusFilter,
    setStudentStatusFilter,
    studentDepartmentFilter,
    setStudentDepartmentFilter,
    departmentOptions,
    studentForm,
    setStudentFormValue,
    isSubmittingStudent,
    isBulkImporting,
    updatingStudentId,
    editingStudentId,
    editStudentForm,
    setEditStudentFormValue,
    handleCreateStudent,
    handleBulkCsvUpload,
    handleStudentStatusUpdate,
    handleStartEditStudent,
    handleSaveEditedStudent,
    handleCancelEditStudent,
    handleRemoveStudent,
    studentCounts,

    requests,
    filteredRequests,
    isLoadingRequests,
    requestSearch,
    setRequestSearch,
    requestStatusFilter,
    setRequestStatusFilter,
    selectedRequestIds,
    setSelectedRequestIds,
    rejectionReasonByRequestId,
    setRejectionReasonByRequestId,
    issueFileByRequestId,
    setIssueFileByRequestId,
    issueExpiryByRequestId,
    setIssueExpiryByRequestId,
    updatingRequestId,
    handleRequestAction,
    handleBulkRequestAction,
    pendingCount,

    credentials,
    isLoadingCredentials,
    handleDirectIssueCredential,
    handleCredentialStatusUpdate,
    handleCredentialReissue,
    selectedCredentialId,
    setSelectedCredentialId,
    isCredentialDrawerOpen,
    setIsCredentialDrawerOpen,

    outboundNotifications,
    inboundNotifications,
    isLoadingInboundNotifications,
    isMarkingAllNotificationsRead,
    handleMarkNotificationRead,
    handleMarkAllNotificationsRead,
    notificationTarget,
    notificationTitle,
    notificationMessage,
    isSubmittingNotification,
    setNotificationTarget,
    setNotificationTitle,
    setNotificationMessage,
    handleNotificationSubmit,
    requestDetailsFromQueryId,
    setRequestDetailsFromQueryId,

    auditLogs,
    isLoadingAuditLogs,
    auditActionFilter,
    setAuditActionFilter,
    auditSeverityFilter,
    setAuditSeverityFilter,
    auditPage,
    setAuditPage,
    auditPageSize,
    setAuditPageSize,
    institutionAuditActionOptions,
    filteredInstitutionAuditLogs,
    totalInstitutionAuditPages,
    currentInstitutionAuditPage,
    pagedInstitutionAuditLogs,

    stepUpModal,
    navigate,
  };
}
