import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import {
  Bell,
  ChartColumnBig,
  CheckCheck,
  FileSearch,
  FileText,
  GraduationCap,
  History,
  LayoutDashboard,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { UserRole } from '../services/user.service';
import {
  AppNotification,
  getNotificationDisplayMessage,
  NotificationService,
} from '../services/notification.service';
import { CredentialService } from '../services/credential.service';
import { useLegacyAuth } from '../auth/auth-context';
import { realtimeService } from '../services/realtime.service';
import logoCompact from '../assets/c-version_logo.png';
import ButtonLoadingContent from '../components/common/ButtonLoadingContent';

const NAV_LINKS: Record<UserRole, Array<{ to: string; label: string; icon: LucideIcon }>> = {
  STUDENT: [
    { to: '/student/credentials', label: 'Credentials', icon: GraduationCap },
    { to: '/student/requests', label: 'Requests', icon: FileText },
    { to: '/student/profile', label: 'Profile', icon: User },
  ],
  INSTITUTION: [
    { to: '/institution', label: 'Overview', icon: LayoutDashboard },
    { to: '/institution/issue', label: 'Credentials', icon: GraduationCap },
    { to: '/institution/students', label: 'Students', icon: Users },
    { to: '/institution/requests', label: 'Requests', icon: FileText },
    { to: '/institution/analytics', label: 'Analytics', icon: ChartColumnBig },
    { to: '/institution/receipt-verify', label: 'Receipt Verify', icon: FileSearch },
    { to: '/institution/logs', label: 'Audit Logs', icon: History },
  ],
  ADMIN: [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/risk', label: 'Risk Review', icon: Shield },
    { to: '/admin/logs', label: 'Audit Logs', icon: History },
  ],
};

const formatNotificationDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
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
  const { user, isLoading } = useLegacyAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [headerNotifications, setHeaderNotifications] = useState<AppNotification[]>([]);
  const [isLoadingHeaderNotifications, setIsLoadingHeaderNotifications] = useState(false);
  const [hasLoadedHeaderNotifications, setHasLoadedHeaderNotifications] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [hasNewInstitutionRequests, setHasNewInstitutionRequests] = useState(false);
  const bellButtonRef = useRef<HTMLButtonElement | null>(null);
  const bellPanelRef = useRef<HTMLDivElement | null>(null);
  const notificationMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationRefreshTimerRef = useRef<number | null>(null);
  const requestIndicatorRefreshTimerRef = useRef<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          Loading session...
        </div>
      </div>
    );
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
  const path = location.pathname;
  const navLinks = NAV_LINKS[role] || [];
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const firstName = user.firstName || displayName;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const bellRouteByRole: Record<UserRole, string | null> = {
    STUDENT: '/student/notifications',
    INSTITUTION: '/institution/notifications',
    ADMIN: '/admin/notifications',
  };
  const bellTargetRoute = bellRouteByRole[role];
  const isNotificationPageOpen = Boolean(
    bellTargetRoute && (path === bellTargetRoute || path.startsWith(`${bellTargetRoute}/`)),
  );

  const loadUnreadNotificationsCount = useCallback(async () => {
    try {
      const unread = await NotificationService.list({ read: false, page: 1, pageSize: 200 });
      setUnreadNotificationsCount(withoutStepUpOtpNotifications(unread.items).length);
    } catch (error) {
      console.error('Failed to load unread notifications:', error);
    }
  }, []);

  const loadHeaderNotifications = useCallback(async () => {
    setIsLoadingHeaderNotifications(true);
    try {
      const data = await NotificationService.list({ page: 1, pageSize: 20 });
      setHeaderNotifications(data.items);
      const safeItems = withoutStepUpOtpNotifications(data.items);
      setUnreadNotificationsCount(safeItems.filter(item => !item.read).length);
      setHasLoadedHeaderNotifications(true);
    } catch (error) {
      console.error('Failed to load header notifications:', error);
      setHeaderNotifications([]);
    } finally {
      setIsLoadingHeaderNotifications(false);
    }
  }, []);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    const target = headerNotifications.find(item => item.id === notificationId);
    if (!target || target.read) {
      return;
    }

    setHeaderNotifications(previous =>
      previous.map(item => (item.id === notificationId ? { ...item, read: true } : item)),
    );

    setUnreadNotificationsCount(previous => Math.max(0, previous - 1));

    try {
      const updated = await NotificationService.markRead(notificationId, true);
      setHeaderNotifications(previous =>
        previous.map(item => (item.id === notificationId ? updated : item)),
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      setHeaderNotifications(previous =>
        previous.map(item => (item.id === notificationId ? target : item)),
      );
      setUnreadNotificationsCount(previous => previous + 1);
    } finally {
    }
  }, [headerNotifications]);

  const markAllHeaderNotificationsRead = useCallback(async () => {
    const visibleNotifications = withoutStepUpOtpNotifications(headerNotifications);
    const hasUnread = visibleNotifications.some(item => !item.read);
    if (!hasUnread) return;

    const previousNotifications = headerNotifications;
    setIsMarkingAllRead(true);
    setHeaderNotifications(previous => previous.map(item => ({ ...item, read: true })));
    const previousUnreadCount = unreadNotificationsCount;
    setUnreadNotificationsCount(0);

    try {
      await NotificationService.markAllRead();
    } catch (error) {
      console.error('Failed to mark all header notifications as read:', error);
      setHeaderNotifications(previousNotifications);
      setUnreadNotificationsCount(previousUnreadCount);
    } finally {
      setIsMarkingAllRead(false);
    }
  }, [headerNotifications, unreadNotificationsCount]);

  const refreshInstitutionRequestIndicator = useCallback(async () => {
    if (role !== 'INSTITUTION') {
      setHasNewInstitutionRequests(false);
      return;
    }

    try {
      const pendingRequests = await CredentialService.listRequests({ status: 'PENDING' });
      if (pendingRequests.length === 0) {
        setHasNewInstitutionRequests(false);
        return;
      }

      const newestPendingRequestTime = pendingRequests.reduce((latest, request) => {
        const createdAtTime = new Date(request.createdAt).getTime();
        if (Number.isNaN(createdAtTime)) return latest;
        return Math.max(latest, createdAtTime);
      }, 0);

      if (!newestPendingRequestTime) {
        setHasNewInstitutionRequests(false);
        return;
      }

      const lastSeenRaw = window.localStorage.getItem(INSTITUTION_REQUESTS_LAST_SEEN_KEY);
      const lastSeenTime = lastSeenRaw ? Number(lastSeenRaw) : 0;
      setHasNewInstitutionRequests(newestPendingRequestTime > (Number.isNaN(lastSeenTime) ? 0 : lastSeenTime));
    } catch (error) {
      console.error('Failed to refresh institution request indicator:', error);
    }
  }, [role]);

  const buildNotificationTargetPath = useCallback((notification: AppNotification): string | null => {
    const credentialId = parseNotificationMetadataString(notification.metadata, 'credentialId');
    if (credentialId) {
      if (role === 'STUDENT') {
        return `/student/credentials/${encodeURIComponent(credentialId)}`;
      }
      if (role === 'INSTITUTION') {
        return `/institution/issue?credentialId=${encodeURIComponent(credentialId)}`;
      }
      return '/admin/notifications';
    }

    const requestId = parseNotificationMetadataString(notification.metadata, 'requestId');
    if (requestId) {
      if (role === 'STUDENT') {
        return `/student/requests?requestId=${encodeURIComponent(requestId)}`;
      }
      if (role === 'INSTITUTION') {
        return `/institution/requests?requestId=${encodeURIComponent(requestId)}`;
      }
      return `/admin/notifications?requestId=${encodeURIComponent(requestId)}`;
    }

    return bellTargetRoute;
  }, [bellTargetRoute, role]);

  const handleHeaderNotificationClick = useCallback(async (notification: AppNotification) => {
    await markNotificationRead(notification.id);
    const targetPath = buildNotificationTargetPath(notification);
    if (!targetPath) return;
    setIsNotificationMenuOpen(false);
    setIsNotificationOpen(false);
    navigate(targetPath);
  }, [buildNotificationTargetPath, markNotificationRead, navigate]);

  useEffect(() => {
    void loadUnreadNotificationsCount();
  }, [loadUnreadNotificationsCount]);

  useEffect(() => {
    if (!isNotificationOpen || hasLoadedHeaderNotifications) {
      setIsNotificationMenuOpen(false);
      return;
    }

    void loadHeaderNotifications();
  }, [hasLoadedHeaderNotifications, isNotificationOpen, loadHeaderNotifications]);

  useEffect(() => {
    if (role !== 'INSTITUTION') {
      setHasNewInstitutionRequests(false);
      return;
    }

    void refreshInstitutionRequestIndicator();
  }, [refreshInstitutionRequestIndicator, role]);

  useEffect(() => {
    if (!isNotificationOpen) {
      return undefined;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedBellButton = bellButtonRef.current?.contains(target);
      const clickedPanel = bellPanelRef.current?.contains(target);
      const clickedMenuButton = notificationMenuButtonRef.current?.contains(target);
      const clickedMenu = notificationMenuRef.current?.contains(target);

      if (isNotificationMenuOpen && !clickedMenuButton && !clickedMenu) {
        setIsNotificationMenuOpen(false);
      }

      if (!clickedBellButton && !clickedPanel) {
        setIsNotificationOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isNotificationMenuOpen, isNotificationOpen]);

  useEffect(() => {
    const scheduleNotificationRefresh = () => {
      if (notificationRefreshTimerRef.current) return;
      notificationRefreshTimerRef.current = window.setTimeout(() => {
        notificationRefreshTimerRef.current = null;
        void loadUnreadNotificationsCount();
        if (isNotificationOpen) {
          void loadHeaderNotifications();
        }
      }, 350);
    };

    const scheduleRequestIndicatorRefresh = () => {
      if (requestIndicatorRefreshTimerRef.current) return;
      requestIndicatorRefreshTimerRef.current = window.setTimeout(() => {
        requestIndicatorRefreshTimerRef.current = null;
        if (role === 'INSTITUTION') {
          void refreshInstitutionRequestIndicator();
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
    isNotificationOpen,
    loadHeaderNotifications,
    loadUnreadNotificationsCount,
    refreshInstitutionRequestIndicator,
    role,
  ]);

  useEffect(() => {
    if (!isNotificationPageOpen) {
      return;
    }
    setIsNotificationOpen(false);
    setIsNotificationMenuOpen(false);
  }, [isNotificationPageOpen]);

  useEffect(() => {
    if (role !== 'INSTITUTION' || !path.startsWith('/institution/requests')) {
      return;
    }
    window.localStorage.setItem(INSTITUTION_REQUESTS_LAST_SEEN_KEY, String(Date.now()));
    setHasNewInstitutionRequests(false);
  }, [path, role]);

  const filteredHeaderNotifications = useMemo(() => {
    const safeNotifications = withoutStepUpOtpNotifications(headerNotifications);

    if (notificationFilter === 'UNREAD') {
      return safeNotifications.filter(item => !item.read);
    }
    return safeNotifications;
  }, [headerNotifications, notificationFilter]);

  const unreadHeaderCount = useMemo(
    () => filteredHeaderNotifications.filter(item => !item.read).length,
    [filteredHeaderNotifications],
  );

  if (!expectedRoutePrefix) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (!path.startsWith(expectedRoutePrefix)) {
    return <Navigate to={expectedRoutePrefix} replace />;
  }

  if (role === 'INSTITUTION' && path.startsWith('/institution/history')) {
    return <Navigate to="/institution/requests" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50 font-sans selection:bg-primary-600 selection:text-white">
      {/* ── Sidebar ── */}
      <aside
        className={`flex flex-col border-r border-neutral-200 bg-white transition-[width] duration-200 ease-in-out ${
          sidebarCollapsed ? 'w-16' : 'w-56'
        }`}
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
            {navLinks.map(link => {
              const showRequestAlert =
                role === 'INSTITUTION' &&
                link.to === '/institution/requests' &&
                hasNewInstitutionRequests;
              const NavIcon = link.icon;

              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === expectedRoutePrefix}
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
                  {!sidebarCollapsed && <span className="truncate">{link.label}</span>}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Sidebar footer — collapse toggle */}
        <div className="shrink-0 border-t border-neutral-200 px-2 py-2">
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
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-neutral-500">
              {greeting}, <span className="text-neutral-700">{firstName}</span>
            </p>
          </div>

          <div className="flex items-center gap-1">
            {/* Notification bell */}
            <div className="relative">
              <button
                ref={bellButtonRef}
                type="button"
                onClick={() => setIsNotificationOpen(previous => !previous)}
                disabled={isNotificationPageOpen}
                className={`relative inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                  isNotificationPageOpen
                    ? 'bg-neutral-100 text-neutral-900'
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
                }`}
                aria-label="Open notifications"
                aria-expanded={isNotificationOpen && !isNotificationPageOpen}
              >
                <Bell size={16} />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-error-500 px-1 text-[10px] font-semibold text-white">
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </span>
                )}
              </button>

              {/* Notification panel */}
              {isNotificationOpen && (
                <div
                  ref={bellPanelRef}
                  className="absolute right-0 top-10 z-50 w-80 sm:w-[22rem]"
                >
                  <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-overlay">
                    <div className="max-h-[75vh] overflow-y-auto overscroll-contain">
                      {/* Panel header */}
                      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                        <h3 className="text-sm font-semibold text-neutral-900">Notifications</h3>
                        <div className="relative">
                          <button
                            ref={notificationMenuButtonRef}
                            type="button"
                            onClick={() => setIsNotificationMenuOpen(prev => !prev)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                            aria-label="Notification options"
                          >
                            <MoreHorizontal size={14} />
                          </button>

                          {isNotificationMenuOpen && (
                            <div
                              ref={notificationMenuRef}
                              className="absolute right-0 top-8 z-10 min-w-48 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  void markAllHeaderNotificationsRead();
                                  setIsNotificationMenuOpen(false);
                                }}
                                disabled={unreadHeaderCount === 0 || isMarkingAllRead}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <CheckCheck size={14} />
                                {isMarkingAllRead ? <ButtonLoadingContent label="Marking" /> : 'Mark all as read'}
                              </button>
                              {bellTargetRoute && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsNotificationMenuOpen(false);
                                    setIsNotificationOpen(false);
                                    navigate(bellTargetRoute);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                                >
                                  <Bell size={14} />
                                  View all notifications
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Filter tabs */}
                      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2">
                        <div className="inline-flex rounded-md border border-neutral-200 p-0.5">
                          <button
                            type="button"
                            onClick={() => setNotificationFilter('ALL')}
                            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                              notificationFilter === 'ALL'
                                ? 'bg-neutral-900 text-white'
                                : 'text-neutral-600 hover:text-neutral-900'
                            }`}
                          >
                            All
                          </button>
                          <button
                            type="button"
                            onClick={() => setNotificationFilter('UNREAD')}
                            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                              notificationFilter === 'UNREAD'
                                ? 'bg-neutral-900 text-white'
                                : 'text-neutral-600 hover:text-neutral-900'
                            }`}
                          >
                            Unread
                          </button>
                        </div>
                        {bellTargetRoute && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsNotificationOpen(false);
                              navigate(bellTargetRoute);
                            }}
                            className="text-xs font-medium text-primary-600 transition-colors hover:text-primary-700"
                          >
                            See all
                          </button>
                        )}
                      </div>

                      {/* Notification list */}
                      <div className="p-2">
                        {isLoadingHeaderNotifications && (
                          <div className="space-y-1.5 py-1">
                            {[1, 2, 3].map(item => (
                              <div key={item} className="h-16 rounded-md skeleton-shimmer" />
                            ))}
                          </div>
                        )}

                        {!isLoadingHeaderNotifications && filteredHeaderNotifications.length === 0 && (
                          <div className="py-10 text-center text-sm text-neutral-400">
                            No notifications
                          </div>
                        )}

                        {!isLoadingHeaderNotifications && filteredHeaderNotifications.length > 0 && (
                          <div className="space-y-0.5">
                            {filteredHeaderNotifications.map(notification => (
                              <button
                                key={notification.id}
                                type="button"
                                onClick={() => void handleHeaderNotificationClick(notification)}
                                className={`w-full rounded-md px-3 py-2.5 text-left transition-colors ${
                                  notification.read
                                    ? 'hover:bg-neutral-50'
                                    : 'bg-primary-50/40 hover:bg-primary-50'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-medium text-neutral-900">{notification.title}</p>
                                  {!notification.read && (
                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2">
                                  {getNotificationDisplayMessage(notification, {
                                    institutionNameFallback: user.institution?.institutionName ?? null,
                                  })}
                                </p>
                                <p className="mt-1 text-[11px] text-neutral-400">
                                  {formatNotificationDate(notification.createdAt)}
                                </p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mx-1 h-5 w-px bg-neutral-200" />

            {/* User avatar */}
            <div className="relative inline-flex items-center">
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
