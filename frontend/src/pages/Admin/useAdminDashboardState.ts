import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AuditAction, AuditLogEntry, AuditService, AuditSeverity } from '../../services/audit.service';
import {
  RiskBand,
  RiskEventRecord,
  RiskReviewReasonCode,
  RiskReviewStatus,
  RiskService,
  RiskWorkerStatus,
} from '../../services/risk.service';
import { User, UserRole, UserService, UserStatus } from '../../services/user.service';
import { CredentialRequest, CredentialService } from '../../services/credential.service';
import { AppNotification, NotificationService } from '../../services/notification.service';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStepUp } from '../../hooks/useStepUp';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useToast } from '../../hooks/useToast';
import { useSearchParamsState } from '../../hooks/useSearchParamsState';
import { appQueryKeys } from '../../lib/queryKeys';
import { getApiErrorMessage } from '../../utils/errors';
import { getRoleStyle, getRiskBandStyle, getRiskReviewStyle } from '../../utils/statusStyles';

// Re-export shared style helpers so existing imports continue to work
export { getRoleStyle as getRoleStyles, getRiskBandStyle as getRiskBandStyles, getRiskReviewStyle as getRiskReviewStyles };

// --- Types ---
export type AdminSection = 'overview' | 'users' | 'risk' | 'reports' | 'logs' | 'notifications';
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
export const getFullName = (user: User) => [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ').trim();

export const getInitials = (user: User) => {
  const source = getFullName(user) || user.email || 'U';
  const tokens = source.split(' ').filter(Boolean);
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0] || ''}${tokens[1][0] || ''}`.toUpperCase();
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
  if (pathname.includes('/admin/reports')) return 'reports';
  if (pathname.includes('/admin/logs')) return 'logs';
  if (pathname.includes('/admin/notifications')) return 'notifications';
  return 'overview';
};

const timeSensitiveQueryOptions = {
  staleTime: 1000 * 30,
  refetchOnWindowFocus: 'always' as const,
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

  // Notifications
  notifications: AppNotification[];
  isLoadingNotifications: boolean;
  isMarkingAllNotificationsRead: boolean;
  handleMarkNotificationRead: (notificationId: string) => Promise<void>;
  handleMarkAllNotificationsRead: () => Promise<void>;

  // Credential requests
  credentialRequests: CredentialRequest[];
  isLoadingCredentialRequests: boolean;

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
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryClient = useQueryClient();

  // --- Users state ---
  const { data: users = [], isLoading: isLoadingUsers, error: usersQueryError } = useQuery({ queryKey: appQueryKeys.admin.users(), queryFn: () => UserService.list() });
  const [userActionError, setUsersError] = useState<string | null>(null);
  const usersError = userActionError || (usersQueryError ? 'Unable to load users from the server.' : null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);
  const [search, setSearch] = useSearchParamsState<string>('q', '');
  const [roleFilter, setRoleFilter] = useSearchParamsState<RoleFilter>('rf', 'ALL');
  const [statusFilter, setStatusFilter] = useSearchParamsState<StatusFilter>('sf', 'ALL');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // --- Notification state ---
  const { data: notificationsData, isLoading: isLoadingNotifications } = useQuery({ queryKey: appQueryKeys.admin.notifications(), queryFn: () => NotificationService.list({ page: 1, pageSize: 100 }), enabled: section === 'notifications' || section === 'reports', ...timeSensitiveQueryOptions });
  const notifications = notificationsData?.items || [];
  const [isMarkingAllNotificationsRead, setIsMarkingAllNotificationsRead] = useState(false);

  const setNotifications = (updater: (prev: AppNotification[]) => AppNotification[]) => {
    queryClient.setQueryData(appQueryKeys.admin.notifications(), (oldData: any) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        items: updater(oldData.items || [])
      };
    });
  };

  const setUsers = (updater: (prev: User[]) => User[]) => {
    queryClient.setQueryData(appQueryKeys.admin.users(), (oldData: any) => {
      if (!oldData) return oldData;
      return updater(oldData as User[]);
    });
  };

  const setRiskEvents = (updater: (prev: RiskEventRecord[]) => RiskEventRecord[]) => {
    queryClient.setQueryData(appQueryKeys.admin.riskEvents({ riskPage, riskPageSize, riskBandFilter, riskReviewFilter, reviewedOnly }), (oldData: any) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        items: updater(oldData.items || [])
      };
    });
  };

  const setRiskSummary = (updater: (prev: any) => any) => {
    queryClient.setQueryData(appQueryKeys.admin.riskEvents({ riskPage, riskPageSize, riskBandFilter, riskReviewFilter, reviewedOnly }), (oldData: any) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        summary: updater(oldData.summary)
      };
    });
  };

  // --- Credential requests state ---
  const { data: credentialRequests = [], isLoading: isLoadingCredentialRequests } = useQuery({ queryKey: appQueryKeys.admin.requests(), queryFn: () => CredentialService.listRequests() });

  // --- Audit logs state ---
  const { data: auditLogs = [], isLoading: isLoadingAuditLogs } = useQuery({ queryKey: appQueryKeys.admin.auditLogs(), queryFn: () => AuditService.list(), enabled: section === 'logs' || section === 'reports', ...timeSensitiveQueryOptions });
  const [auditActionFilter, setAuditActionFilter] = useSearchParamsState<'ALL' | AuditAction>('aa', 'ALL');
  const [auditSeverityFilter, setAuditSeverityFilter] = useSearchParamsState<'ALL' | AuditSeverity>('as', 'ALL');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(20);

  // --- Risk events state ---
  const [riskBandFilter, setRiskBandFilter] = useSearchParamsState<RiskBand | 'ALL'>('rb', 'ALL');
  const [riskReviewFilter, setRiskReviewFilter] = useSearchParamsState<RiskReviewStatus | 'ALL'>('rr', 'ALL');
  const [reviewedOnly, setReviewedOnly] = useState(false);
  const [riskPage, setRiskPage] = useState(1);
  const [riskPageSize, setRiskPageSize] = useState(20);

  const { data: riskEventData, isLoading: isLoadingRiskEvents } = useQuery({ 
    queryKey: appQueryKeys.admin.riskEvents({ riskPage, riskPageSize, riskBandFilter, riskReviewFilter, reviewedOnly }), 
    queryFn: () => RiskService.list({ page: riskPage, pageSize: riskPageSize, riskBand: riskBandFilter, reviewStatus: riskReviewFilter, reviewedOnly }),
    enabled: section === 'risk' || section === 'overview' || section === 'reports',
    ...timeSensitiveQueryOptions,
  });
  const riskEvents: RiskEventRecord[] = riskEventData?.items || [];
  const riskTotal: number = riskEventData?.total || 0;
  const riskSummary: {
    pendingReviewCount: number;
    highRiskCount: number;
    criticalRiskCount: number;
    confirmedAbuseCount: number;
  } = riskEventData?.summary || { pendingReviewCount: 0, highRiskCount: 0, criticalRiskCount: 0, confirmedAbuseCount: 0 };

  const { data: riskWorkerStatus = null, isLoading: isLoadingRiskWorkerStatus } = useQuery({ queryKey: appQueryKeys.admin.riskWorkerStatus(), queryFn: () => RiskService.getWorkerStatus(), enabled: section === 'risk' || section === 'overview' || section === 'reports', ...timeSensitiveQueryOptions });
  const [reviewingRiskEventId, setReviewingRiskEventId] = useState<string | null>(null);
  const [selectedRiskEventId, setSelectedRiskEventId] = useState<string | null>(null);
  const [selectedRiskEvent, setSelectedRiskEvent] = useState<RiskEventRecord | null>(null);
  const [isLoadingSelectedRiskEvent, setIsLoadingSelectedRiskEvent] = useState(false);
  const [isExportingRiskReport, setIsExportingRiskReport] = useState(false);
  const handledUserQueryRef = useRef<string | null>(null);
  const handledRiskQueryRef = useRef<string | null>(null);

  // --- External hooks ---
  const { requestStepUpToken, stepUpModal } = useStepUp();
  const { showToast } = useToast();

  // --- Toast bridge ---
  useEffect(() => {
    if (usersError) showToast({ variant: 'error', message: usersError });
  }, [showToast, usersError]);

  // --- Section-based loading ---

// Handled by React Query variables

  useEffect(() => {
    if (section !== 'users') {
      handledUserQueryRef.current = null;
      return;
    }

    const requestedRole = searchParams.get('role');
    const requestedStatus = searchParams.get('status');
    const requestedUserId = searchParams.get('userId');
    const querySignature = `${requestedRole || ''}|${requestedStatus || ''}|${requestedUserId || ''}`;

    if (handledUserQueryRef.current === querySignature) {
      return;
    }

    const nextRoleFilter = ROLE_OPTIONS.includes(requestedRole as RoleFilter)
      ? (requestedRole as RoleFilter)
      : 'ALL';
    const nextStatusFilter = STATUS_OPTIONS.includes(requestedStatus as StatusFilter)
      ? (requestedStatus as StatusFilter)
      : 'ALL';

    setRoleFilter(nextRoleFilter);
    setStatusFilter(nextStatusFilter);

    if (requestedUserId && users.some(user => user.id === requestedUserId)) {
      setSelectedUserId(requestedUserId);
    } else if (!requestedUserId) {
      setSelectedUserId(null);
    }

    handledUserQueryRef.current = querySignature;
  }, [searchParams, section, users]);

  // --- Realtime sync ---

  const realtimeRefreshMap = useMemo(() => ({
    users: () => { if (section !== 'logs') void queryClient.invalidateQueries({ queryKey: appQueryKeys.admin.users() }); },
    credentialRequests: () => { void queryClient.invalidateQueries({ queryKey: appQueryKeys.admin.requests() }); },
    audit: () => { if (section === 'logs' || section === 'reports') void queryClient.invalidateQueries({ queryKey: appQueryKeys.admin.auditLogs() }); },
    notifications: () => { if (section === 'notifications' || section === 'reports') void queryClient.invalidateQueries({ queryKey: appQueryKeys.admin.notifications() }); },
    'security:SECURITY_RISK_EVENTS_UPDATED': () => {
      if (section === 'risk' || section === 'overview' || section === 'reports') {
        void queryClient.invalidateQueries({ queryKey: appQueryKeys.admin.riskEventsRoot() });
        void queryClient.invalidateQueries({ queryKey: appQueryKeys.admin.riskWorkerStatus() });
      }
    },
  }), [queryClient, riskBandFilter, riskPage, riskPageSize, riskReviewFilter, reviewedOnly, section]);

  useRealtimeSync(realtimeRefreshMap);

  // --- Filter reset effects ---

  useEffect(() => { setAuditPage(1); }, [auditActionFilter, auditSeverityFilter, auditPageSize]);
  useEffect(() => { setRiskPage(1); }, [reviewedOnly, riskBandFilter, riskReviewFilter, riskPageSize]);
  useEffect(() => {
    if (reviewedOnly && riskReviewFilter === 'PENDING_REVIEW') setRiskReviewFilter('ALL');
  }, [reviewedOnly, riskReviewFilter]);

  // --- Computed / memoized ---

  const totalUsers = users.length;
  const approvedUsers = users.filter(u => u.status === 'APPROVED').length;
  const pendingUsers = users.filter(u => u.status === 'PENDING').length;
  const suspendedUsers = users.filter(u => u.status === 'SUSPENDED').length;
  const studentAccounts = users.filter(u => u.role === 'STUDENT').length;

  const roleDistribution = useMemo(() => ({
    STUDENT: users.filter(u => u.role === 'STUDENT').length,
    INSTITUTION: users.filter(u => u.role === 'INSTITUTION').length,
    ADMIN: users.filter(u => u.role === 'ADMIN').length,
  }), [users]);

  const statusDistribution = useMemo(() => ({
    APPROVED: approvedUsers,
    PENDING: pendingUsers,
    REJECTED: users.filter(u => u.status === 'REJECTED').length,
    SUSPENDED: suspendedUsers,
  }), [approvedUsers, pendingUsers, suspendedUsers, users]);

  const recentUsers = useMemo(() =>
    [...users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
  [users]);

  const userSearchStrings = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) {
      const searchable = [user.id, user.email, user.firstName, user.middleName || '', user.lastName, user.role, user.status, user.institution?.institutionName || ''].join(' ').toLowerCase();
      map.set(user.id, searchable);
    }
    return map;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return users.filter(user => {
      if (roleFilter !== 'ALL' && user.role !== roleFilter) return false;
      if (statusFilter !== 'ALL' && user.status !== statusFilter) return false;
      if (!keyword) return true;
      const searchable = userSearchStrings.get(user.id);
      return searchable ? searchable.includes(keyword) : false;
    });
  }, [users, roleFilter, statusFilter, search, userSearchStrings]);

  const selectedUser = useMemo(
    () => filteredUsers.find(u => u.id === selectedUserId) || null,
    [filteredUsers, selectedUserId],
  );

  const pendingQueue = useMemo(
    () => users
      .filter(u => u.role === 'INSTITUTION' && u.status === 'PENDING')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [users],
  );

  const handleMarkNotificationRead = useCallback(async (notificationId: string) => {
    const target = notifications.find(item => item.id === notificationId);
    if (!target || target.read) return;

    setNotifications(previous =>
      previous.map(item => (item.id === notificationId ? { ...item, read: true } : item)),
    );

    try {
      const updated = await NotificationService.markRead(notificationId, true);
      setNotifications(previous =>
        previous.map(item => (item.id === notificationId ? updated : item)),
      );
    } catch (error) {
      setNotifications(previous =>
        previous.map(item => (item.id === notificationId ? target : item)),
      );
      showToast({ variant: 'error', message: getApiErrorMessage(error) || 'Unable to update notification state.' });
    }
  }, [notifications, showToast]);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    const hasUnread = notifications.some(item => !item.read);
    if (!hasUnread) return;

    const previousNotifications = notifications;
    setIsMarkingAllNotificationsRead(true);
    setNotifications(previous => previous.map(item => ({ ...item, read: true })));

    try {
      await NotificationService.markAllRead();
    } catch (error) {
      setNotifications(() => previousNotifications);
      showToast({ variant: 'error', message: getApiErrorMessage(error) || 'Unable to mark notifications as read.' });
    } finally {
      setIsMarkingAllNotificationsRead(false);
    }
  }, [notifications, showToast]);

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
      showToast({ variant: 'success', message: 'User status updated successfully.' });
    } catch (error) {
      if (error instanceof Error && error.message === 'STEP_UP_CANCELLED') return;
      console.error('Failed to update user status:', error);
      setUsersError('Unable to update user status at this time.');
    } finally {
      setIsUpdatingStatus(null);
    }
  }, [requestStepUpToken, showToast]);

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
      showToast({ variant: 'success', message: 'User role updated successfully.' });
    } catch (error) {
      if (error instanceof Error && error.message === 'STEP_UP_CANCELLED') return;
      console.error('Failed to update user role:', error);
      setUsersError('Unable to update user role at this time.');
    } finally {
      setIsUpdatingRole(null);
    }
  }, [requestStepUpToken, showToast]);

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
    [riskEvents, showToast],
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

  useEffect(() => {
    const riskEventId = searchParams.get('riskEventId');
    const targetId = searchParams.get('targetId');
    const actorId = searchParams.get('actorId');
    const riskQueryKey = [riskEventId || '', targetId || '', actorId || ''].join('|');

    if (section !== 'risk' || (!riskEventId && !targetId && !actorId)) {
      handledRiskQueryRef.current = null;
      return;
    }

    if (handledRiskQueryRef.current === riskQueryKey) {
      return;
    }

    if (riskEventId) {
      handledRiskQueryRef.current = riskQueryKey;
      void openRiskEventDetails(riskEventId);
      return;
    }

    const matchingEvent = riskEvents.find(event => (
      (targetId && event.targetId === targetId) ||
      (actorId && event.actorId === actorId)
    ));

    if (matchingEvent) {
      handledRiskQueryRef.current = riskQueryKey;
      void openRiskEventDetails(matchingEvent.id);
    }
  }, [openRiskEventDetails, riskEvents, searchParams, section]);

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

    notifications,
    isLoadingNotifications,
    isMarkingAllNotificationsRead,
    handleMarkNotificationRead,
    handleMarkAllNotificationsRead,

    credentialRequests,
    isLoadingCredentialRequests,

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
