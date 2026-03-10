import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import {
  Bell,
  ChartColumnBig,
  Building2,
  CheckCheck,
  ChevronDown,
  FileSearch,
  FileText,
  History,
  LayoutGrid,
  LayoutDashboard,
  MoreHorizontal,
  Settings,
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
import credentialsIcon from '../assets/credentials.svg';
import ButtonLoadingContent from '../components/common/ButtonLoadingContent';

const NAV_LINKS: Record<UserRole, Array<{ to: string; label: string }>> = {
  STUDENT: [
    { to: '/student/credentials', label: 'My Credential' },
    { to: '/student/requests', label: 'Requests' },
    { to: '/student/profile', label: 'Profile' },
  ],
  INSTITUTION: [
    { to: '/institution', label: 'Overview' },
    { to: '/institution/issue', label: 'Student Credentials' },
    { to: '/institution/students', label: 'Students' },
    { to: '/institution/requests', label: 'Requests' },
    { to: '/institution/analytics', label: 'Analytics' },
    { to: '/institution/receipt-verify', label: 'Receipt Verification' },
    { to: '/institution/logs', label: 'Audit Logs' },
  ],
  EMPLOYER: [
    { to: '/employer', label: 'Dashboard' },
    { to: '/employer/requests', label: 'My Requests' },
    { to: '/employer/verifications', label: 'Verifications' },
    { to: '/employer/partners', label: 'Institutions' },
    { to: '/employer/logs', label: 'Audit Logs' },
  ],
  ADMIN: [
    { to: '/admin', label: 'Home' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/risk', label: 'Risk Review' },
    { to: '/admin/logs', label: 'Audit Logs' },
    { to: '/admin/settings', label: 'Settings' },
  ],
};

const NAV_ICONS: Record<string, LucideIcon> = {
  '/student': LayoutGrid,
  '/student/requests': FileText,
  '/student/profile': User,
  '/institution': LayoutDashboard,
  '/institution/analytics': ChartColumnBig,
  '/institution/students': Users,
  '/institution/requests': FileText,
  '/institution/receipt-verify': FileSearch,
  '/employer': LayoutDashboard,
  '/employer/requests': FileText,
  '/employer/verifications': Shield,
  '/employer/partners': Building2,
  '/employer/logs': History,
  '/admin': LayoutGrid,
  '/admin/users': Users,
  '/admin/risk': Shield,
  '/admin/logs': History,
  '/admin/settings': Settings,
};

const CREDENTIAL_ICON_ROUTES = new Set<string>([
  '/student/credentials',
  '/institution/issue',
]);

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
    return <div className="h-screen flex items-center justify-center bg-white text-slate-700 font-medium">Loading session...</div>;
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
    EMPLOYER: '/employer',
    INSTITUTION: '/institution',
  };

  const expectedRoutePrefix = roleRoutes[role];
  const path = location.pathname;
  const navLinks = NAV_LINKS[role] || [];
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const welcomeFirstName = user.firstName || displayName;
  const welcomeText = `Welcome, ${welcomeFirstName}`;

  const bellRouteByRole: Record<UserRole, string | null> = {
    STUDENT: '/student/notifications',
    INSTITUTION: '/institution/notifications',
    ADMIN: '/admin/notifications',
    EMPLOYER: null,
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
      if (role === 'EMPLOYER') {
        return `/employer/verifications?credentialId=${encodeURIComponent(credentialId)}`;
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
      if (role === 'EMPLOYER') {
        return `/employer/requests?requestId=${encodeURIComponent(requestId)}`;
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
    <div className="min-h-screen bg-white font-sans selection:bg-slate-900 selection:text-white">
      <div className="relative flex min-h-screen flex-1 flex-col">
        <div className="bg-slate-50 border-b border-slate-200">
          <div className="flex h-12 items-center justify-between pl-2 pr-4 sm:h-13 sm:pl-4 sm:pr-6 lg:h-13 lg:pl-5 lg:pr-8">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <img src={logoCompact} alt="Credence logo" className="block h-6 w-6 object-contain sm:h-7 sm:w-7" />
              <div className="h-6 w-px bg-slate-200 sm:h-7" />
              <p className="text-sm font-medium text-slate-500 sm:text-base">{welcomeText}</p>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="relative">
                <button
                  ref={bellButtonRef}
                  type="button"
                  onClick={() => setIsNotificationOpen(previous => !previous)}
                  disabled={isNotificationPageOpen}
                  className={`relative rounded-full p-2.5 transition-all duration-300 ${
                    isNotificationPageOpen
                      ? 'cursor-default bg-transparent text-slate-900'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  aria-label="Open notifications"
                  aria-expanded={isNotificationOpen && !isNotificationPageOpen}
                  aria-current={isNotificationPageOpen ? 'page' : undefined}
                >
                  <Bell
                    size={22}
                    className={isNotificationPageOpen ? 'fill-slate-900 text-slate-900' : undefined}
                  />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                    </span>
                  )}
                </button>

                {isNotificationOpen && (
                  <div
                    ref={bellPanelRef}
                    className="absolute -right-3 top-12 z-50 w-85 sm:top-14 sm:w-90"
                  >
                    <div className="pointer-events-none absolute -top-3 right-8 h-3.5 w-3.5 border-r border-t border-slate-200 bg-white [clip-path:polygon(0_100%,100%_0,100%_100%)]" />
                    <div className="max-h-[75vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_22px_45px_rgba(15,23,42,0.2)]">
                      <div className="max-h-[75vh] overflow-y-auto overscroll-contain">
                        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                          <div>
                            <p className="text-lg font-semibold text-slate-900">Notifications</p>
                          </div>
                          <div className="relative">
                            <button
                              ref={notificationMenuButtonRef}
                              type="button"
                              onClick={() => setIsNotificationMenuOpen(previous => !previous)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                              aria-label="Notification options"
                              aria-expanded={isNotificationMenuOpen}
                            >
                              <MoreHorizontal size={18} />
                            </button>

                            {isNotificationMenuOpen && (
                              <div
                                ref={notificationMenuRef}
                                className="absolute right-0 top-9 z-10 min-w-55"
                              >
                                <div className="pointer-events-none absolute -top-3 right-3 h-3.5 w-3.5 border-r border-t border-slate-200 bg-white [clip-path:polygon(0_100%,100%_0,100%_100%)]" />
                                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_14px_30px_rgba(15,23,42,0.18)]">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void markAllHeaderNotificationsRead();
                                      setIsNotificationMenuOpen(false);
                                    }}
                                    disabled={unreadHeaderCount === 0 || isMarkingAllRead}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <CheckCheck size={15} />
                                    {isMarkingAllRead ? <ButtonLoadingContent label="Marking" /> : 'Mark all as read'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsNotificationMenuOpen(false)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    <Settings size={15} />
                                    Notification settings
                                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                      N/a
                                    </span>
                                  </button>
                                  {bellTargetRoute && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsNotificationMenuOpen(false);
                                        setIsNotificationOpen(false);
                                        navigate(bellTargetRoute);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      <Bell size={15} />
                                      Open notifications
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between px-4 py-2.5">
                          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                            <button
                              type="button"
                              onClick={() => setNotificationFilter('ALL')}
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                notificationFilter === 'ALL'
                                  ? 'bg-slate-900 text-white'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              All
                            </button>
                            <button
                              type="button"
                              onClick={() => setNotificationFilter('UNREAD')}
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                notificationFilter === 'UNREAD'
                                  ? 'bg-slate-900 text-white'
                                  : 'text-slate-600 hover:text-slate-900'
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
                              className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-sky-600 transition-colors hover:bg-slate-100"
                            >
                              See all
                            </button>
                          )}
                        </div>

                        <div className="px-3 pb-3">
                          {isLoadingHeaderNotifications && (
                            <div className="space-y-2 py-1">
                              {[1, 2, 3].map(item => (
                                <div key={item} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
                              ))}
                            </div>
                          )}

                          {!isLoadingHeaderNotifications && filteredHeaderNotifications.length === 0 && (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                              No notifications found.
                            </div>
                          )}

                          {!isLoadingHeaderNotifications && filteredHeaderNotifications.length > 0 && (
                            <div className="space-y-2">
                              {filteredHeaderNotifications.map(notification => (
                                <button
                                  key={notification.id}
                                  type="button"
                                  onClick={() => void handleHeaderNotificationClick(notification)}
                                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                                    notification.read
                                      ? 'border-slate-200 bg-white hover:bg-slate-50'
                                      : 'border-sky-200 bg-sky-50/40 hover:bg-sky-50'
                                  }`}
                                >
                                  <div className="mb-1.5 flex items-start justify-between gap-3">
                                    <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                                    {!notification.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500" />}
                                  </div>
                                  <p className="text-sm text-slate-600">
                                    {getNotificationDisplayMessage(notification, {
                                      institutionNameFallback: user.institution?.institutionName ?? null,
                                    })}
                                  </p>
                                  <div className="mt-1.5 flex items-center justify-between">
                                    <p className="text-xs text-slate-500">{formatNotificationDate(notification.createdAt)}</p>
                                  </div>
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

              <div className="h-8 w-px bg-slate-200" />
              <div className="relative inline-flex items-center">
                <UserButton afterSignOutUrl="/" />
                <span className="pointer-events-none absolute top-4 left-4.5 inline-flex h-3 w-3 items-center justify-center rounded-full border border-slate-300 bg-slate-700 text-white shadow-sm">
                  <ChevronDown size={8} />
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky top-0 z-40 bg-slate-50">
          <div className="flex items-center px-4 sm:px-6 lg:px-8">
            <nav className="flex h-10 items-center gap-1.5 overflow-x-auto lg:h-11 lg:gap-2">
              {navLinks.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === expectedRoutePrefix}
                  className={({ isActive }) =>
                    `inline-flex h-full items-center whitespace-nowrap border-b px-3 py-0 text-[13px] font-semibold transition sm:text-sm lg:px-3.5 ${
                      isActive
                        ? 'border-slate-900 text-slate-900'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`
                  }
                >
                  {(() => {
                    const useCredentialSvg = CREDENTIAL_ICON_ROUTES.has(link.to);
                    const Icon = NAV_ICONS[link.to];
                    const showRequestAlert =
                      role === 'INSTITUTION' &&
                      link.to === '/institution/requests' &&
                      hasNewInstitutionRequests;
                    return (
                      <>
                        <span className="relative mr-1.5 inline-flex shrink-0">
                          {useCredentialSvg && (
                            <img
                              src={credentialsIcon}
                              alt=""
                              aria-hidden="true"
                              className="h-3.75 w-3.75 object-contain"
                            />
                          )}
                          {!useCredentialSvg && Icon && <Icon size={15} />}
                          {showRequestAlert && (
                            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-red-500" />
                          )}
                        </span>
                        {link.label}
                      </>
                    );
                  })()}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="pointer-events-none h-px bg-slate-200" />
        </div>

        <main className="flex-1 bg-white p-8">
          <div className="mx-auto max-w-7xl space-y-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
