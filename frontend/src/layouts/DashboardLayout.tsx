import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import GlobalLoading from '../components/common/GlobalLoading';
import {
  AlertTriangle,
  Bell,
  ChartColumnBig,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  FileSearch,
  FolderOpen,
  Menu,
  X,
  FileText,
  GraduationCap,
  History,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { UserRole } from '../services/user.service';
import {
  AppNotification,
  NotificationListResponse,
  NotificationService,
  getNotificationDisplayMessage,
} from '../services/notification.service';
import { CredentialService } from '../services/credential.service';
import { useLegacyAuth } from '../auth/auth-context';
import { appQueryKeys } from '../lib/queryKeys';
import { realtimeService } from '../services/realtime.service';
import logoCompact from '../assets/c-version_logo.png';
import TopbarNotificationsPanel from '../components/notifications/TopbarNotificationsPanel';
import { resolveAdminNotificationDestination } from '../pages/Admin/notificationDestination';
import { resolveInstitutionNotificationDestination } from '../pages/Institution/notificationDestination';
import { resolveStudentNotificationDestination } from '../pages/Student/notificationDestination';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  children?: Array<{ to: string; label: string; icon: LucideIcon }>;
}

const NAV_LINKS: Record<UserRole, NavItem[]> = {
  STUDENT: [
    { to: '/student/credentials', label: 'Credentials', icon: GraduationCap },
    { to: '/student/requests', label: 'Requests', icon: FileText },
    { to: '/student/profile', label: 'Profile', icon: User },
  ],
  INSTITUTION: [
    { to: '/institution', label: 'Overview', icon: LayoutDashboard },
    {
      to: '/institution/issue',
      label: 'Credentials',
      icon: GraduationCap,
      children: [
        { to: '/institution/issue', label: 'Issue Credential', icon: ClipboardCheck },
        { to: '/institution/issue/awaiting', label: 'Awaiting Issuance', icon: Clock3 },
        { to: '/institution/issue/manage', label: 'Management', icon: FolderOpen },
      ],
    },
    { to: '/institution/students', label: 'Students', icon: Users },
    { to: '/institution/requests', label: 'Requests', icon: FileText },
    { to: '/institution/announcement', label: 'Announcement', icon: Bell },
    { to: '/institution/analytics', label: 'Analytics', icon: ChartColumnBig },
    { to: '/institution/reports', label: 'Reports', icon: Download },
    { to: '/institution/receipt-verify', label: 'Verify Receipt', icon: FileSearch },
    { to: '/institution/logs', label: 'Audit Logs', icon: History },
  ],
  ADMIN: [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/risk', label: 'Risk Review', icon: AlertTriangle },
    { to: '/admin/reports', label: 'Reports', icon: Download },
    { to: '/admin/logs', label: 'Audit Logs', icon: History },
  ],
};

const parseNotificationMetadataString = (
  metadata: Record<string, unknown> | null,
  key: string,
): string | null => {
  if (!metadata) return null;
  const value = metadata[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

const isStepUpOtpNotification = (notification: AppNotification): boolean => {
  const event = parseNotificationMetadataString(notification.metadata, 'event');
  const normalizedTitle = notification.title.trim().toLowerCase();
  return event === 'STEP_UP_OTP' || normalizedTitle === 'security verification code';
};

const withoutStepUpOtpNotifications = (notifications: AppNotification[]): AppNotification[] =>
  notifications.filter(notification => !isStepUpOtpNotification(notification));

const INSTITUTION_REQUESTS_LAST_SEEN_KEY = 'institution_requests_last_seen_at';

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading } = useLegacyAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [expandedNavGroup, setExpandedNavGroup] = useState<string | null>(() =>
    location.pathname.startsWith('/institution/issue') ? '/institution/issue' : null,
  );
  const [collapsedFlyoutGroup, setCollapsedFlyoutGroup] = useState<string | null>(null);
  const [collapsedFlyoutTop, setCollapsedFlyoutTop] = useState(0);
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);
  const [isMarkingAllNotificationsRead, setIsMarkingAllNotificationsRead] = useState(false);
  const [lastSeenInstitutionRequestAt, setLastSeenInstitutionRequestAt] = useState(() => {
    if (typeof window === 'undefined') {
      return 0;
    }
    const stored = window.localStorage.getItem(INSTITUTION_REQUESTS_LAST_SEEN_KEY);
    const parsed = stored ? Number(stored) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  });
  const notificationRefreshTimerRef = useRef<number | null>(null);
  const requestIndicatorRefreshTimerRef = useRef<number | null>(null);
  const notificationsPanelRef = useRef<HTMLDivElement | null>(null);
  const notificationsButtonRef = useRef<HTMLButtonElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const collapsedFlyoutRef = useRef<HTMLDivElement | null>(null);
  const rawRole = user?.role as UserRole | undefined;
  const path = location.pathname;

  const timeSensitiveQueryOptions = {
    staleTime: 1000 * 30,
    refetchOnWindowFocus: 'always' as const,
  };

  useQuery({
    queryKey: appQueryKeys.layout.unreadNotificationsCount(),
    queryFn: async () => {
      const unread = await NotificationService.list({ read: false, page: 1, pageSize: 200 });
      return withoutStepUpOtpNotifications(unread.items).length;
    },
    enabled: Boolean(user),
    ...timeSensitiveQueryOptions,
  });

  const notificationsQueryKey =
    rawRole === 'ADMIN'
      ? appQueryKeys.admin.notifications()
      : rawRole === 'INSTITUTION'
        ? appQueryKeys.institution.notifications()
        : rawRole === 'STUDENT'
          ? appQueryKeys.student.notifications()
          : null;

  const {
    data: notificationsData,
    isLoading: isLoadingNotificationsPanel,
  } = useQuery({
    queryKey: notificationsQueryKey ?? ['layout', 'notifications', 'disabled'],
    queryFn: () => NotificationService.list({ page: 1, pageSize: 100 }),
    enabled: Boolean(user) && Boolean(notificationsQueryKey),
    ...timeSensitiveQueryOptions,
  });

  const inboxNotifications = useMemo(
    () => withoutStepUpOtpNotifications(notificationsData?.items || []),
    [notificationsData],
  );
  const visibleUnreadNotificationsCount = useMemo(
    () => inboxNotifications.filter(notification => !notification.read).length,
    [inboxNotifications],
  );

  const { data: newestPendingRequestTime = 0 } = useQuery({
    queryKey: appQueryKeys.layout.institutionPendingRequestIndicator(),
    queryFn: async () => {
      const pendingRequests = await CredentialService.listRequests({ status: 'PENDING' });
      return pendingRequests.reduce((latest, request) => {
        const createdAtTime = new Date(request.createdAt).getTime();
        if (Number.isNaN(createdAtTime)) return latest;
        return Math.max(latest, createdAtTime);
      }, 0);
    },
    enabled: rawRole === 'INSTITUTION',
    ...timeSensitiveQueryOptions,
  });

  const hasNewInstitutionRequests = useMemo(
    () => rawRole === 'INSTITUTION' && newestPendingRequestTime > lastSeenInstitutionRequestAt,
    [lastSeenInstitutionRequestAt, newestPendingRequestTime, rawRole],
  );

  const roleNotificationsRoute =
    rawRole === 'ADMIN'
      ? '/admin/notifications'
      : rawRole === 'INSTITUTION'
        ? '/institution/notifications'
        : rawRole === 'STUDENT'
          ? '/student/notifications'
          : null;

  if (isLoading) {
    return <GlobalLoading />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.status !== 'APPROVED') {
    return <Navigate to="/" replace />;
  }

  if (user.role === 'STUDENT' && !user.profile) {
    return <Navigate to="/" replace />;
  }

  const role = user.role as UserRole;
  const roleRoutes: Record<UserRole, string> = {
    STUDENT: '/student',
    ADMIN: '/admin',
    INSTITUTION: '/institution',
  };

  const roleLabelMap: Record<UserRole, string> = {
    STUDENT: 'Student',
    INSTITUTION: user.institution?.institutionName || 'Institution',
    ADMIN: 'Admin Console',
  };

  const expectedRoutePrefix = roleRoutes[role];
  const navLinks = NAV_LINKS[role] || [];
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const firstName = user.firstName || displayName;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  useEffect(() => {
    const scheduleNotificationRefresh = () => {
      if (notificationRefreshTimerRef.current) return;
      notificationRefreshTimerRef.current = window.setTimeout(() => {
        notificationRefreshTimerRef.current = null;
        void queryClient.invalidateQueries({ queryKey: appQueryKeys.layout.unreadNotificationsCount() });
        if (notificationsQueryKey) {
          void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
        }
      }, 350);
    };

    const scheduleRequestIndicatorRefresh = () => {
      if (requestIndicatorRefreshTimerRef.current) return;
      requestIndicatorRefreshTimerRef.current = window.setTimeout(() => {
        requestIndicatorRefreshTimerRef.current = null;
        if (role === 'INSTITUTION') {
          void queryClient.invalidateQueries({ queryKey: appQueryKeys.layout.institutionPendingRequestIndicator() });
        }
      }, 350);
    };

    const unsubscribe = realtimeService.subscribe(event => {
      if (event.domain === 'notifications') {
        scheduleNotificationRefresh();
      }
      if (event.domain === 'credentialRequests') {
        scheduleRequestIndicatorRefresh();
      }
    });

    return () => {
      unsubscribe();
      if (notificationRefreshTimerRef.current) {
        window.clearTimeout(notificationRefreshTimerRef.current);
        notificationRefreshTimerRef.current = null;
      }
      if (requestIndicatorRefreshTimerRef.current) {
        window.clearTimeout(requestIndicatorRefreshTimerRef.current);
        requestIndicatorRefreshTimerRef.current = null;
      }
    };
  }, [
    notificationsQueryKey,
    queryClient,
    role,
  ]);

  useEffect(() => {
    if (role !== 'INSTITUTION' || !path.startsWith('/institution/requests')) {
      return;
    }
    const timestamp = Date.now();
    window.localStorage.setItem(INSTITUTION_REQUESTS_LAST_SEEN_KEY, String(timestamp));
    setLastSeenInstitutionRequestAt(timestamp);
  }, [path, role]);

  useEffect(() => {
    setCollapsedFlyoutGroup(null);
  }, [location.pathname, sidebarCollapsed]);

  useEffect(() => {
    setIsNotificationsPanelOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!collapsedFlyoutGroup) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideFlyout = collapsedFlyoutRef.current?.contains(target);
      const clickedInsideSidebar = sidebarRef.current?.contains(target);

      if (!clickedInsideFlyout && !clickedInsideSidebar) {
        setCollapsedFlyoutGroup(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCollapsedFlyoutGroup(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [collapsedFlyoutGroup]);

  useEffect(() => {
    if (!isNotificationsPanelOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedPanel = notificationsPanelRef.current?.contains(target);
      const clickedButton = notificationsButtonRef.current?.contains(target);
      if (!clickedPanel && !clickedButton) {
        setIsNotificationsPanelOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotificationsPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isNotificationsPanelOpen]);

  if (!expectedRoutePrefix) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (!path.startsWith(expectedRoutePrefix)) {
    return <Navigate to={expectedRoutePrefix} replace />;
  }

  if (role === 'INSTITUTION' && path.startsWith('/institution/history')) {
    return <Navigate to="/institution/requests" replace />;
  }

  const syncNotificationCaches = (nextItems: AppNotification[]) => {
    if (!notificationsQueryKey) {
      return;
    }

    queryClient.setQueryData(
      notificationsQueryKey,
      (oldData: NotificationListResponse | undefined) => ({
        items: nextItems,
        pagination: oldData?.pagination ?? {
          page: 1,
          pageSize: 100,
          total: nextItems.length,
        },
      }),
    );

    queryClient.setQueryData(
      appQueryKeys.layout.unreadNotificationsCount(),
      withoutStepUpOtpNotifications(nextItems).filter(notification => !notification.read).length,
    );
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    const target = inboxNotifications.find(notification => notification.id === notificationId);
    if (!target || target.read) {
      return;
    }

    const previousItems = notificationsData?.items || [];
    const optimisticItems = previousItems.map(item =>
      item.id === notificationId ? { ...item, read: true } : item,
    );

    syncNotificationCaches(optimisticItems);

    try {
      const updated = await NotificationService.markRead(notificationId, true);
      syncNotificationCaches(previousItems.map(item => (item.id === updated.id ? updated : item)));
    } catch {
      syncNotificationCaches(previousItems);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (isMarkingAllNotificationsRead || inboxNotifications.every(notification => notification.read)) {
      return;
    }

    const previousItems = notificationsData?.items || [];
    setIsMarkingAllNotificationsRead(true);
    syncNotificationCaches(previousItems.map(item => ({ ...item, read: true })));

    try {
      await NotificationService.markAllRead();
    } catch {
      syncNotificationCaches(previousItems);
    } finally {
      setIsMarkingAllNotificationsRead(false);
    }
  };

  const handleSeeAllNotifications = () => {
    setIsNotificationsPanelOpen(false);
    if (roleNotificationsRoute) {
      navigate(roleNotificationsRoute);
    }
  };

  const handleNotificationPanelClick = (notification: AppNotification) => {
    if (!notification.read) {
      void handleMarkNotificationRead(notification.id);
    }

    setIsNotificationsPanelOpen(false);

    if (role === 'ADMIN') {
      const destination = resolveAdminNotificationDestination(notification);
      if (destination.kind === 'risk') {
        const params = new URLSearchParams();
        if (destination.riskEventId) params.set('riskEventId', destination.riskEventId);
        if (destination.targetId) params.set('targetId', destination.targetId);
        if (destination.actorId) params.set('actorId', destination.actorId);
        navigate(`/admin/risk${params.toString() ? `?${params.toString()}` : ''}`);
        return;
      }
      if (destination.kind === 'users') {
        const params = new URLSearchParams();
        if (destination.userId) params.set('userId', destination.userId);
        if (destination.roleFilter) params.set('role', destination.roleFilter);
        if (destination.statusFilter) params.set('status', destination.statusFilter);
        navigate(`/admin/users${params.toString() ? `?${params.toString()}` : ''}`);
        return;
      }
      navigate('/admin/notifications');
      return;
    }

    if (role === 'INSTITUTION') {
      const destination = resolveInstitutionNotificationDestination(notification);
      if (destination.kind === 'credential') {
        navigate(`/institution/issue/manage?credentialId=${encodeURIComponent(destination.credentialId)}`);
        return;
      }
      if (destination.kind === 'request') {
        navigate(`/institution/requests?requestId=${encodeURIComponent(destination.requestId)}`);
        return;
      }
      navigate('/institution/notifications');
      return;
    }

    if (role === 'STUDENT') {
      const destination = resolveStudentNotificationDestination(notification);
      if (destination.kind === 'credential') {
        navigate(`/student/credentials/${encodeURIComponent(destination.credentialId)}`);
        return;
      }
      if (destination.kind === 'request') {
        navigate(`/student/requests?requestId=${encodeURIComponent(destination.requestId)}`);
        return;
      }
      navigate('/student/notifications');
    }
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-neutral-50 font-sans selection:bg-primary-600 selection:text-white">
      {/* ── Mobile sidebar overlay ── */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-neutral-950/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-neutral-200 bg-white transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          sidebarCollapsed ? 'w-16' : 'w-56'
        } md:transition-[width]`}
      >
        {/* Sidebar header */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-neutral-200 px-4">
          <img
            src={logoCompact}
            alt="Credence"
            className="h-7 w-7 shrink-0 object-contain"
          />
          {!sidebarCollapsed && (
            <span className="truncate text-sm font-semibold text-neutral-900">
              {roleLabelMap[role]}
            </span>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <div className="space-y-0.5">
            {navLinks.map((link: NavItem) => {
              const showRequestAlert =
                role === 'INSTITUTION' &&
                link.to === '/institution/requests' &&
                hasNewInstitutionRequests;
              const NavIcon = link.icon;

              if (link.children) {
                const childLinks = link.children;
                const isGroupActive = path.startsWith(link.to);
                const isExpanded = expandedNavGroup === link.to;

                return (
                  <div key={link.to}>
                    <button
                      type="button"
                      onClick={event => {
                        if (sidebarCollapsed) {
                          const buttonRect = event.currentTarget.getBoundingClientRect();
                          if (buttonRect) {
                            const flyoutHeightEstimate = 72 + childLinks.length * 42;
                            const viewportPadding = 16;
                            const maxTop = window.innerHeight - flyoutHeightEstimate - viewportPadding;
                            setCollapsedFlyoutTop(Math.max(viewportPadding, Math.min(buttonRect.top, maxTop)));
                          }
                          setCollapsedFlyoutGroup(prev => (prev === link.to ? null : link.to));
                          return;
                        }
                        setExpandedNavGroup(prev => (prev === link.to ? null : link.to));
                      }}
                      className={`group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors ${
                        isGroupActive
                          ? 'bg-neutral-100 text-neutral-900'
                          : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                      } ${sidebarCollapsed ? 'justify-center' : ''}`}
                      title={sidebarCollapsed ? link.label : undefined}
                    >
                      <span className="shrink-0"><NavIcon size={16} /></span>
                      {!sidebarCollapsed && (
                        <>
                          <span className="flex-1 truncate text-left">{link.label}</span>
                          {isExpanded ? <ChevronDown size={14} className="shrink-0 text-neutral-400" /> : <ChevronRight size={14} className="shrink-0 text-neutral-400" />}
                        </>
                      )}
                    </button>
                    <AnimatePresence initial={false}>
                      {sidebarCollapsed && collapsedFlyoutGroup === link.to && (
                        <motion.div
                          ref={collapsedFlyoutRef}
                          initial={{ opacity: 0, x: -8, scale: 0.98 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -8, scale: 0.98 }}
                          transition={{ duration: 0.16, ease: 'easeOut' }}
                          className="fixed left-18 z-[60] w-60 rounded-xl border border-neutral-200 bg-white p-2 shadow-2xl"
                          style={{ top: collapsedFlyoutTop }}
                        >
                          <div className="border-b border-neutral-200 px-3 py-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">
                              {link.label}
                            </p>
                          </div>
                          <div className="mt-1 space-y-1">
                            {childLinks.map((child: NonNullable<NavItem['children']>[number]) => {
                              const ChildIcon = child.icon;
                              return (
                                <NavLink
                                  key={child.to}
                                  to={child.to}
                                  end
                                  onClick={() => {
                                    setCollapsedFlyoutGroup(null);
                                    setMobileNavOpen(false);
                                  }}
                                  className={({ isActive }) =>
                                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                      isActive
                                        ? 'bg-neutral-100 text-neutral-900'
                                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                                    }`
                                  }
                                >
                                  <ChildIcon size={15} />
                                  <span className="truncate">{child.label}</span>
                                </NavLink>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <AnimatePresence initial={false}>
                      {!sidebarCollapsed && isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0, y: -6 }}
                          animate={{ height: 'auto', opacity: 1, y: 0 }}
                          exit={{ height: 0, opacity: 0, y: -6 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <div className="mt-0.5 space-y-0.5 pl-4">
                            {childLinks.map((child: NonNullable<NavItem['children']>[number], index: number) => {
                              const ChildIcon = child.icon;
                              return (
                                <motion.div
                                  key={child.to}
                                  initial={{ opacity: 0, x: -6 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -6 }}
                                  transition={{ duration: 0.16, ease: 'easeOut', delay: index * 0.03 }}
                                >
                                  <NavLink
                                    to={child.to}
                                    end
                                    onClick={() => setMobileNavOpen(false)}
                                    className={({ isActive }) =>
                                      `group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                                        isActive
                                          ? 'bg-neutral-100 text-neutral-900'
                                          : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                                      }`
                                    }
                                  >
                                    <ChildIcon size={14} />
                                    <span className="truncate">{child.label}</span>
                                  </NavLink>
                                </motion.div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }

              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === expectedRoutePrefix}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors ${
                      isActive
                        ? 'bg-neutral-100 text-neutral-900'
                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                    } ${sidebarCollapsed ? 'justify-center' : ''}`
                  }
                  title={sidebarCollapsed ? link.label : undefined}
                >
                    <span className="relative shrink-0">
                      <NavIcon size={16} />
                      {showRequestAlert && (
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-error-500" />
                      )}
                    </span>
                    {!sidebarCollapsed && (
                      <span className="truncate flex-1">{link.label}</span>
                    )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Sidebar footer — collapse toggle (desktop only) */}
        <div className="hidden shrink-0 border-t border-neutral-200 px-2 py-2 md:block">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(prev => !prev)}
            className="flex w-full items-center justify-center gap-2 rounded-md px-2 py-2 text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-600"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-3 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(prev => !prev)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 md:hidden"
              aria-label="Toggle navigation"
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <p className="hidden text-sm font-medium text-neutral-500 sm:block">
              {greeting}, <span className="text-neutral-700">{firstName}</span>
            </p>
          </div>

          <div className="flex flex-1 items-center justify-end gap-1">
            <div id="top-nav-search-portal" className="flex flex-1 justify-end mx-2 sm:mx-4" />

            <div className="flex items-center gap-3">
              <div className="relative inline-flex items-center">
                <button
                  ref={notificationsButtonRef}
                  type="button"
                  onClick={() => setIsNotificationsPanelOpen(previous => !previous)}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
                  aria-label="Open notifications"
                  aria-expanded={isNotificationsPanelOpen}
                >
                  <Bell size={18} />
                  {visibleUnreadNotificationsCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-error-500 px-1 text-[10px] font-bold text-white">
                      {visibleUnreadNotificationsCount > 99 ? '99+' : visibleUnreadNotificationsCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {isNotificationsPanelOpen && (
                    <motion.div
                      ref={notificationsPanelRef}
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      className="fixed inset-x-3 top-16 z-[70] h-[min(34rem,calc(100dvh-5rem))] sm:absolute sm:right-0 sm:left-auto sm:top-12 sm:w-[26rem] sm:h-[min(32rem,calc(100dvh-4.5rem))]"
                    >
                      <TopbarNotificationsPanel
                        notifications={inboxNotifications}
                        isLoading={isLoadingNotificationsPanel}
                        isMarkingAllRead={isMarkingAllNotificationsRead}
                        unreadCount={visibleUnreadNotificationsCount}
                        onMarkAllRead={handleMarkAllNotificationsRead}
                        onNotificationClick={handleNotificationPanelClick}
                        onSeeAll={handleSeeAllNotifications}
                        getMessage={notification =>
                          getNotificationDisplayMessage(notification, {
                            institutionNameFallback:
                              role === 'STUDENT' ? user.institution?.institutionName || null : null,
                          })
                        }
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="h-5 w-px bg-neutral-200" />

              {/* User avatar */}
              <div className="relative ml-1 inline-flex items-center">
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
