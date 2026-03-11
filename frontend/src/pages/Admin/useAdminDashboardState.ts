import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AuditAction, AuditLogEntry, AuditService, AuditSeverity } from '../../services/audit.service';
import {
  RiskBand,
  RiskEventRecord,
  RiskOverviewSummary,
  RiskReviewReasonCode,
  RiskReviewStatus,
  RiskService,
  RiskWorkerStatus,
} from '../../services/risk.service';
import { AdminUserOverviewSummary, User, UserRole, UserService, UserStatus } from '../../services/user.service';
import { useStepUp } from '../../hooks/useStepUp';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useToast } from '../../hooks/useToast';
import { getApiErrorMessage } from '../../utils/errors';

// --- Types ---
export type AdminSection = 'overview' | 'users' | 'risk' | 'logs';
export type RoleFilter = UserRole | 'ALL';
export type StatusFilter = UserStatus | 'ALL';

// --- Constants ---
export const ROLE_OPTIONS: RoleFilter[] = ['ALL', 'STUDENT', 'INSTITUTION', 'ADMIN'];
export const STATUS_OPTIONS: StatusFilter[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];
export const USER_STATUS_ACTIONS: UserStatus[] = ['APPROVED', 'REJECTED', 'SUSPENDED', 'PENDING'];
export const USER_ROLE_ACTIONS: UserRole[] = ['STUDENT', 'INSTITUTION', 'ADMIN'];
export const RISK_BAND_OPTIONS: Array<RiskBand | 'ALL'> = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const RISK_REVIEW_OPTIONS: Array<RiskReviewStatus | 'ALL'> = [
  'ALL',
  'PENDING_REVIEW',
  'CONFIRMED_ABUSE',
  'BENIGN',
  'UNCERTAIN',
];

// --- Helpers ---
export const getFullName = (user: Pick<User, 'firstName' | 'middleName' | 'lastName' | 'email'>) =>
  [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ').trim();

export const getInitials = (user: User) => {
  const source = getFullName(user) || user.email || 'U';
  const tokens = source.split(' ').filter(Boolean);
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0] || ''}${tokens[1][0] || ''}`.toUpperCase();
};

export const getRoleStyles = (role: UserRole) => {
  if (role === 'ADMIN') return 'border-neutral-400 bg-neutral-100 text-neutral-800';
  if (role === 'INSTITUTION') return 'border-cyan-200 bg-cyan-50 text-cyan-800';
  return 'border-neutral-200 bg-neutral-50 text-neutral-700';
};

export const getLinkedOrganizationLabel = (user: User) => {
  if (user.role === 'INSTITUTION') {
    return user.institution?.institutionName || '-';
  }
  return '-';
};

const getSection = (pathname: string): AdminSection => {
  if (pathname.includes('/admin/users')) return 'users';
  if (pathname.includes('/admin/risk')) return 'risk';
  if (pathname.includes('/admin/logs')) return 'logs';
  return 'overview';
};

export const getRiskBandStyles = (riskBand: RiskBand) => {
  if (riskBand === 'CRITICAL') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (riskBand === 'HIGH') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (riskBand === 'MEDIUM') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  return 'border-neutral-200 bg-neutral-50 text-neutral-700';
};

export const getRiskReviewStyles = (reviewStatus: RiskReviewStatus) => {
  if (reviewStatus === 'CONFIRMED_ABUSE') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (reviewStatus === 'BENIGN') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (reviewStatus === 'UNCERTAIN') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-neutral-200 bg-neutral-50 text-neutral-700';
};

// =============================================================================
// Hook
// =============================================================================

export interface AdminDashboardState {
  section: AdminSection;

  // Users
  users: User[];
  isLoadingUsers: boolean;
  filteredUsers: User[];
  selectedUser: User | null;
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
  search: string;
  setSearch: (v: string) => void;
  roleFilter: RoleFilter;
  setRoleFilter: (v: RoleFilter) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  isUpdatingStatus: string | null;
  isUpdatingRole: string | null;
  handleStatusUpdate: (userId: string, status: UserStatus) => Promise<void>;
  handleRoleUpdate: (userId: string, role: UserRole) => Promise<void>;
  totalUsers: number;
  approvedUsers: number;
  pendingUsers: number;
  suspendedUsers: number;
  studentAccounts: number;
  roleDistribution: Record<'STUDENT' | 'INSTITUTION' | 'ADMIN', number>;
  statusDistribution: Record<'APPROVED' | 'PENDING' | 'REJECTED' | 'SUSPENDED', number>;
  recentUsers: User[];
  pendingQueue: User[];
  userOverviewSummary: AdminUserOverviewSummary | null;
  isLoadingUserOverviewSummary: boolean;

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
  adminAuditActionOptions: Array<'ALL' | AuditAction>;
  filteredAdminAuditLogs: AuditLogEntry[];
  totalAdminAuditPages: number;
  currentAdminAuditPage: number;
  pagedAdminAuditLogs: AuditLogEntry[];

  // Risk events
  riskEvents: RiskEventRecord[];
  isLoadingRiskEvents: boolean;
  riskBandFilter: RiskBand | 'ALL';
  setRiskBandFilter: (v: RiskBand | 'ALL') => void;
  riskReviewFilter: RiskReviewStatus | 'ALL';
  setRiskReviewFilter: (v: RiskReviewStatus | 'ALL') => void;
  reviewedOnly: boolean;
  setReviewedOnly: (v: boolean) => void;
  riskPage: number;
  setRiskPage: React.Dispatch<React.SetStateAction<number>>;
  riskPageSize: number;
  setRiskPageSize: (v: number) => void;
  riskTotal: number;
  riskSummary: {
    pendingReviewCount: number;
    highRiskCount: number;
    criticalRiskCount: number;
    confirmedAbuseCount: number;
  };
  riskWorkerStatus: RiskWorkerStatus | null;
  isLoadingRiskWorkerStatus: boolean;
  riskOverviewSummary: RiskOverviewSummary | null;
  isLoadingRiskOverviewSummary: boolean;
  reviewingRiskEventId: string | null;
  selectedRiskEventId: string | null;
  selectedRiskEvent: RiskEventRecord | null;
  isLoadingSelectedRiskEvent: boolean;
  isExportingRiskReport: boolean;
  handleRiskReviewUpdate: (
    id: string,
    reviewStatus: RiskReviewStatus,
    reviewReasonCode?: RiskReviewReasonCode | null,
    reviewReasonDetail?: string | null,
    reviewNotes?: string | null,
  ) => Promise<void>;
  openRiskEventDetails: (id: string) => Promise<void>;
  closeRiskEventDetails: () => void;
  exportReviewedRiskReport: () => Promise<void>;

  // Step-up modal
  stepUpModal: React.ReactNode;
}

export function useAdminDashboardState(): AdminDashboardState {
  const location = useLocation();
  const section = getSection(location.pathname);

  // --- Users state ---
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userOverviewSummary, setUserOverviewSummary] = useState<AdminUserOverviewSummary | null>(null);
  const [isLoadingUserOverviewSummary, setIsLoadingUserOverviewSummary] = useState(false);

  // --- Audit logs state ---
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [hasLoadedAuditLogs, setHasLoadedAuditLogs] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState<'ALL' | AuditAction>('ALL');
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<'ALL' | AuditSeverity>('ALL');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(20);

  // --- Risk events state ---
  const [riskEvents, setRiskEvents] = useState<RiskEventRecord[]>([]);
  const [isLoadingRiskEvents, setIsLoadingRiskEvents] = useState(false);
  const [riskBandFilter, setRiskBandFilter] = useState<RiskBand | 'ALL'>('ALL');
  const [riskReviewFilter, setRiskReviewFilter] = useState<RiskReviewStatus | 'ALL'>('ALL');
  const [reviewedOnly, setReviewedOnly] = useState(false);
  const [riskPage, setRiskPage] = useState(1);
  const [riskPageSize, setRiskPageSize] = useState(20);
  const [riskTotal, setRiskTotal] = useState(0);
  const [riskSummary, setRiskSummary] = useState({
    pendingReviewCount: 0,
    highRiskCount: 0,
    criticalRiskCount: 0,
    confirmedAbuseCount: 0,
  });
  const [riskWorkerStatus, setRiskWorkerStatus] = useState<RiskWorkerStatus | null>(null);
  const [isLoadingRiskWorkerStatus, setIsLoadingRiskWorkerStatus] = useState(false);
  const [riskOverviewSummary, setRiskOverviewSummary] = useState<RiskOverviewSummary | null>(null);
  const [isLoadingRiskOverviewSummary, setIsLoadingRiskOverviewSummary] = useState(false);
  const [reviewingRiskEventId, setReviewingRiskEventId] = useState<string | null>(null);
  const [selectedRiskEventId, setSelectedRiskEventId] = useState<string | null>(null);
  const [selectedRiskEvent, setSelectedRiskEvent] = useState<RiskEventRecord | null>(null);
  const [isLoadingSelectedRiskEvent, setIsLoadingSelectedRiskEvent] = useState(false);
  const [isExportingRiskReport, setIsExportingRiskReport] = useState(false);

  // --- External hooks ---
  const { requestStepUpToken, stepUpModal } = useStepUp();
  const { showToast } = useToast();

  // --- Toast bridge ---
  useEffect(() => {
    if (usersError) showToast({ variant: 'error', message: usersError });
  }, [showToast, usersError]);

  // --- Data loaders ---

  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    setUsersError(null);
    try {
      setUsers(await UserService.list());
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
      setUsersError('Unable to load users from the server.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  const loadUserOverviewSummary = useCallback(async () => {
    setIsLoadingUserOverviewSummary(true);
    try {
      setUserOverviewSummary(await UserService.getAdminOverviewSummary());
    } catch (error) {
      setUserOverviewSummary(null);
      showToast({ variant: 'error', message: getApiErrorMessage(error) || 'Unable to load admin overview counts.' });
    } finally {
      setIsLoadingUserOverviewSummary(false);
    }
  }, [showToast]);

  const loadAuditLogs = useCallback(async () => {
    setIsLoadingAuditLogs(true);
    try {
      const data = await AuditService.list();
      setAuditLogs(data);
      setHasLoadedAuditLogs(true);
    } catch (error) {
      setAuditLogs([]);
      setUsersError(getApiErrorMessage(error) || 'Unable to load admin audit logs.');
    } finally {
      setIsLoadingAuditLogs(false);
    }
  }, []);

  const loadRiskEvents = useCallback(async () => {
    setIsLoadingRiskEvents(true);
    try {
      const response = await RiskService.list({
        page: riskPage,
        pageSize: riskPageSize,
        riskBand: riskBandFilter,
        reviewStatus: riskReviewFilter,
        reviewedOnly,
      });
      setRiskEvents(response.items);
      setRiskTotal(response.total);
      setRiskSummary(response.summary);
    } catch (error) {
      setRiskEvents([]);
      showToast({ variant: 'error', message: getApiErrorMessage(error) || 'Unable to load risk review records.' });
    } finally {
      setIsLoadingRiskEvents(false);
    }
  }, [reviewedOnly, riskBandFilter, riskPage, riskPageSize, riskReviewFilter, showToast]);

  const loadRiskWorkerStatus = useCallback(async () => {
    setIsLoadingRiskWorkerStatus(true);
    try {
      setRiskWorkerStatus(await RiskService.getWorkerStatus());
    } catch (error) {
      setRiskWorkerStatus(null);
      showToast({ variant: 'error', message: getApiErrorMessage(error) || 'Unable to load shadow risk worker status.' });
    } finally {
      setIsLoadingRiskWorkerStatus(false);
    }
  }, [showToast]);

  const loadRiskOverviewSummary = useCallback(async () => {
    setIsLoadingRiskOverviewSummary(true);
    try {
      setRiskOverviewSummary(await RiskService.getOverviewSummary());
    } catch (error) {
      setRiskOverviewSummary(null);
      showToast({ variant: 'error', message: getApiErrorMessage(error) || 'Unable to load risk overview summary.' });
    } finally {
      setIsLoadingRiskOverviewSummary(false);
    }
  }, [showToast]);

  // --- Section-based loading ---

  useEffect(() => {
    if (section === 'users') void loadUsers();
  }, [loadUsers, section]);

  useEffect(() => {
    if (section === 'overview') {
      void loadUserOverviewSummary();
      void loadRiskOverviewSummary();
    }
  }, [loadRiskOverviewSummary, loadUserOverviewSummary, section]);

  useEffect(() => {
    if (section === 'logs' && !hasLoadedAuditLogs) void loadAuditLogs();
  }, [hasLoadedAuditLogs, loadAuditLogs, section]);

  useEffect(() => {
    if (section === 'risk') {
      void loadRiskEvents();
      void loadRiskWorkerStatus();
    }
  }, [loadRiskEvents, loadRiskWorkerStatus, section]);

  // --- Realtime sync ---

  const realtimeRefreshMap = useMemo(() => ({
    users: () => {
      if (section === 'users') void loadUsers();
      if (section === 'overview') void loadUserOverviewSummary();
    },
    audit: () => { if (section === 'logs') void loadAuditLogs(); },
    'security:SECURITY_RISK_EVENTS_UPDATED': () => {
      if (section === 'risk') { void loadRiskEvents(); void loadRiskWorkerStatus(); }
      if (section === 'overview') void loadRiskOverviewSummary();
    },
  }), [loadAuditLogs, loadRiskEvents, loadRiskOverviewSummary, loadRiskWorkerStatus, loadUserOverviewSummary, loadUsers, section]);

  useRealtimeSync(realtimeRefreshMap);

  // --- Filter reset effects ---

  useEffect(() => { setAuditPage(1); }, [auditActionFilter, auditSeverityFilter, auditPageSize]);
  useEffect(() => { setRiskPage(1); }, [reviewedOnly, riskBandFilter, riskReviewFilter, riskPageSize]);
  useEffect(() => {
    if (reviewedOnly && riskReviewFilter === 'PENDING_REVIEW') setRiskReviewFilter('ALL');
  }, [reviewedOnly, riskReviewFilter]);

  // --- Computed / memoized ---

  const totalUsers = userOverviewSummary?.totalUsers ?? users.length;
  const approvedUsers = userOverviewSummary?.approvedUsers ?? users.filter(u => u.status === 'APPROVED').length;
  const pendingUsers = userOverviewSummary?.pendingUsers ?? users.filter(u => u.status === 'PENDING').length;
  const suspendedUsers = userOverviewSummary?.suspendedUsers ?? users.filter(u => u.status === 'SUSPENDED').length;
  const studentAccounts = userOverviewSummary?.studentAccounts ?? users.filter(u => u.role === 'STUDENT').length;

  const roleDistribution = useMemo(() => (
    userOverviewSummary?.roleDistribution ?? {
      STUDENT: users.filter(u => u.role === 'STUDENT').length,
      INSTITUTION: users.filter(u => u.role === 'INSTITUTION').length,
      ADMIN: users.filter(u => u.role === 'ADMIN').length,
    }
  ), [userOverviewSummary, users]);

  const statusDistribution = useMemo(() => (
    userOverviewSummary?.statusDistribution ?? {
      APPROVED: approvedUsers,
      PENDING: pendingUsers,
      REJECTED: users.filter(u => u.status === 'REJECTED').length,
      SUSPENDED: suspendedUsers,
    }
  ), [approvedUsers, pendingUsers, suspendedUsers, userOverviewSummary, users]);

  const recentUsers = useMemo(() =>
    [...users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
  [users]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return users.filter(user => {
      if (roleFilter !== 'ALL' && user.role !== roleFilter) return false;
      if (statusFilter !== 'ALL' && user.status !== statusFilter) return false;
      if (!keyword) return true;
      const searchable = [user.id, user.email, user.firstName, user.middleName || '', user.lastName, user.role, user.status, user.institution?.institutionName || ''].join(' ').toLowerCase();
      return searchable.includes(keyword);
    });
  }, [users, roleFilter, statusFilter, search]);

  const selectedUser = useMemo(
    () => filteredUsers.find(u => u.id === selectedUserId) || null,
    [filteredUsers, selectedUserId],
  );

  const pendingQueue = useMemo(
    () => users.filter(u => u.status === 'PENDING').sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [users],
  );

  // Audit computed
  const adminAuditActionOptions = useMemo(
    () => ['ALL', ...Array.from(new Set(auditLogs.map(l => l.action))).sort()] as Array<'ALL' | AuditAction>,
    [auditLogs],
  );

  const filteredAdminAuditLogs = useMemo(
    () => auditLogs.filter(log => {
      if (auditActionFilter !== 'ALL' && log.action !== auditActionFilter) return false;
      if (auditSeverityFilter !== 'ALL' && log.severity !== auditSeverityFilter) return false;
      return true;
    }),
    [auditActionFilter, auditLogs, auditSeverityFilter],
  );

  const totalAdminAuditPages = Math.max(1, Math.ceil(filteredAdminAuditLogs.length / auditPageSize));
  const currentAdminAuditPage = Math.min(auditPage, totalAdminAuditPages);
  const pagedAdminAuditLogs = useMemo(() => {
    const start = (currentAdminAuditPage - 1) * auditPageSize;
    return filteredAdminAuditLogs.slice(start, start + auditPageSize);
  }, [auditPageSize, currentAdminAuditPage, filteredAdminAuditLogs]);

  // --- Handlers ---

  const handleStatusUpdate = useCallback(async (userId: string, status: UserStatus) => {
    setIsUpdatingStatus(userId);
    setUsersError(null);
    try {
      const stepUpToken = await requestStepUpToken({
        action: 'STATUS_CHANGE',
        targetId: userId,
        title: 'Confirm Status Update',
        description: 'Enter the OTP sent to your email to change this account status.',
      });
      const updated = await UserService.updateStatus(userId, status, stepUpToken);
      setUsers(previous => previous.map(u => (u.id === userId ? { ...u, ...updated } : u)));
      void loadUserOverviewSummary();
      showToast({ variant: 'success', message: 'User status updated successfully.' });
    } catch (error) {
      if (error instanceof Error && error.message === 'STEP_UP_CANCELLED') return;
      console.error('Failed to update user status:', error);
      setUsersError('Unable to update user status at this time.');
    } finally {
      setIsUpdatingStatus(null);
    }
  }, [loadUserOverviewSummary, requestStepUpToken, showToast]);

  const handleRoleUpdate = useCallback(async (userId: string, role: UserRole) => {
    setIsUpdatingRole(userId);
    setUsersError(null);
    try {
      const stepUpToken = await requestStepUpToken({
        action: 'ROLE_CHANGE',
        targetId: userId,
        title: 'Confirm Role Update',
        description: 'Enter the OTP sent to your email to change this user role.',
      });
      const updated = await UserService.updateRole(userId, role, stepUpToken);
      setUsers(previous => previous.map(u => (u.id === userId ? { ...u, ...updated } : u)));
      void loadUserOverviewSummary();
      showToast({ variant: 'success', message: 'User role updated successfully.' });
    } catch (error) {
      if (error instanceof Error && error.message === 'STEP_UP_CANCELLED') return;
      console.error('Failed to update user role:', error);
      setUsersError('Unable to update user role at this time.');
    } finally {
      setIsUpdatingRole(null);
    }
  }, [loadUserOverviewSummary, requestStepUpToken, showToast]);

  const handleRiskReviewUpdate = useCallback(
    async (
      id: string,
      reviewStatus: RiskReviewStatus,
      reviewReasonCode?: RiskReviewReasonCode | null,
      reviewReasonDetail?: string | null,
      reviewNotes?: string | null,
    ) => {
      setReviewingRiskEventId(id);
      try {
        const updated = await RiskService.updateReviewStatus(id, {
          reviewStatus,
          reviewReasonCode,
          reviewReasonDetail,
          reviewNotes,
        });
        setRiskEvents(previous =>
          previous.map(event =>
            event.id === id
              ? { ...event, reviewStatus: updated.reviewStatus, reviewedById: updated.reviewedById, reviewedAt: updated.reviewedAt, reviewReasonCode: updated.reviewReasonCode, reviewReasonDetail: updated.reviewReasonDetail, reviewNotes: updated.reviewNotes }
              : event,
          ),
        );
        setSelectedRiskEvent(previous =>
          previous && previous.id === id
            ? { ...previous, reviewStatus: updated.reviewStatus, reviewedById: updated.reviewedById, reviewedAt: updated.reviewedAt, reviewReasonCode: updated.reviewReasonCode, reviewReasonDetail: updated.reviewReasonDetail, reviewNotes: updated.reviewNotes }
            : previous,
        );
        setRiskSummary(previous => {
          const current = riskEvents.find(event => event.id === id);
          const next = { ...previous };
          if (current?.reviewStatus === 'PENDING_REVIEW' && reviewStatus !== 'PENDING_REVIEW') {
            next.pendingReviewCount = Math.max(0, next.pendingReviewCount - 1);
          }
          if (current?.reviewStatus !== 'CONFIRMED_ABUSE' && reviewStatus === 'CONFIRMED_ABUSE') {
            next.confirmedAbuseCount += 1;
          }
          if (current?.reviewStatus === 'CONFIRMED_ABUSE' && reviewStatus !== 'CONFIRMED_ABUSE') {
            next.confirmedAbuseCount = Math.max(0, next.confirmedAbuseCount - 1);
          }
          return next;
        });
        void loadRiskOverviewSummary();
        showToast({
          variant: 'success',
          message:
            reviewNotes !== undefined || reviewReasonCode !== undefined || reviewReasonDetail !== undefined
              ? `Risk event review saved as ${reviewStatus}.`
              : `Risk event marked as ${reviewStatus}.`,
        });
      } catch (error) {
        showToast({ variant: 'error', message: getApiErrorMessage(error) || 'Unable to update risk review status.' });
      } finally {
        setReviewingRiskEventId(null);
      }
    },
    [loadRiskOverviewSummary, riskEvents, showToast],
  );

  const openRiskEventDetails = useCallback(async (id: string) => {
    setSelectedRiskEventId(id);
    setIsLoadingSelectedRiskEvent(true);
    try {
      setSelectedRiskEvent(await RiskService.getById(id));
    } catch (error) {
      setSelectedRiskEvent(null);
      showToast({ variant: 'error', message: getApiErrorMessage(error) || 'Unable to load risk event details.' });
    } finally {
      setIsLoadingSelectedRiskEvent(false);
    }
  }, [showToast]);

  const closeRiskEventDetails = useCallback(() => {
    setSelectedRiskEventId(null);
    setSelectedRiskEvent(null);
    setIsLoadingSelectedRiskEvent(false);
  }, []);

  const exportReviewedRiskReport = useCallback(async () => {
    setIsExportingRiskReport(true);
    try {
      const blob = await RiskService.exportReviewed({
        riskBand: riskBandFilter,
        reviewStatus: riskReviewFilter === 'PENDING_REVIEW' ? 'ALL' : riskReviewFilter,
        reviewedOnly,
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `risk-review-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      showToast({ variant: 'success', message: 'Reviewed risk report downloaded.' });
    } catch (error) {
      showToast({ variant: 'error', message: getApiErrorMessage(error) || 'Unable to export reviewed risk report.' });
    } finally {
      setIsExportingRiskReport(false);
    }
  }, [reviewedOnly, riskBandFilter, riskReviewFilter, showToast]);

  // --- Return ---

  return {
    section,

    users,
    isLoadingUsers,
    filteredUsers,
    selectedUser,
    selectedUserId,
    setSelectedUserId,
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    isUpdatingStatus,
    isUpdatingRole,
    handleStatusUpdate,
    handleRoleUpdate,
    totalUsers,
    approvedUsers,
    pendingUsers,
    suspendedUsers,
    studentAccounts,
    roleDistribution,
    statusDistribution,
    recentUsers,
    pendingQueue,
    userOverviewSummary,
    isLoadingUserOverviewSummary,

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
    adminAuditActionOptions,
    filteredAdminAuditLogs,
    totalAdminAuditPages,
    currentAdminAuditPage,
    pagedAdminAuditLogs,

    riskEvents,
    isLoadingRiskEvents,
    riskBandFilter,
    setRiskBandFilter,
    riskReviewFilter,
    setRiskReviewFilter,
    reviewedOnly,
    setReviewedOnly,
    riskPage,
    setRiskPage,
    riskPageSize,
    setRiskPageSize,
    riskTotal,
    riskSummary,
    riskWorkerStatus,
    isLoadingRiskWorkerStatus,
    riskOverviewSummary,
    isLoadingRiskOverviewSummary,
    reviewingRiskEventId,
    selectedRiskEventId,
    selectedRiskEvent,
    isLoadingSelectedRiskEvent,
    isExportingRiskReport,
    handleRiskReviewUpdate,
    openRiskEventDetails,
    closeRiskEventDetails,
    exportReviewedRiskReport,

    stepUpModal,
  };
}
