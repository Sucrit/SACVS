import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
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
  NotificationService,
} from '../services/notification.service';
import { CredentialService } from '../services/credential.service';
import { useLegacyAuth } from '../auth/auth-context';
import { realtimeService } from '../services/realtime.service';
import logoCompact from '../assets/c-version_logo.png';

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
    { to: '/student/notifications', label: 'Notifications', icon: Bell },
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
    { to: '/institution/analytics', label: 'Analytics', icon: ChartColumnBig },
    { to: '/institution/reports', label: 'Generate Report', icon: Download },
    { to: '/institution/receipt-verify', label: 'Verify Receipt', icon: FileSearch },
    { to: '/institution/logs', label: 'Audit Logs', icon: History },
    { to: '/institution/notifications', label: 'Notifications', icon: Bell },
  ],
  ADMIN: [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/risk', label: 'Risk Review', icon: AlertTriangle },
    { to: '/admin/logs', label: 'Audit Logs', icon: History },
    { to: '/admin/notifications', label: 'Notifications', icon: Bell },
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
  const { user, isLoading } = useLegacyAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [hasNewInstitutionRequests, setHasNewInstitutionRequests] = useState(false);
  const [expandedNavGroup, setExpandedNavGroup] = useState<string | null>(() =>
    location.pathname.startsWith('/institution/issue') ? '/institution/issue' : null,
  );
  const [collapsedFlyoutGroup, setCollapsedFlyoutGroup] = useState<string | null>(null);
  const [collapsedFlyoutTop, setCollapsedFlyoutTop] = useState(0);
  const notificationRefreshTimerRef = useRef<number | null>(null);
  const requestIndicatorRefreshTimerRef = useRef<number | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const collapsedFlyoutRef = useRef<HTMLDivElement | null>(null);

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

  const loadUnreadNotificationsCount = useCallback(async () => {
    try {
      const unread = await NotificationService.list({ read: false, page: 1, pageSize: 200 });
      setUnreadNotificationsCount(withoutStepUpOtpNotifications(unread.items).length);
    } catch (error) {
      console.error('Failed to load unread notifications:', error);
    }
  }, []);

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

  useEffect(() => {
    void loadUnreadNotificationsCount();
  }, [loadUnreadNotificationsCount]);

  useEffect(() => {
    if (role !== 'INSTITUTION') {
      setHasNewInstitutionRequests(false);
      return;
    }

    void refreshInstitutionRequestIndicator();
  }, [refreshInstitutionRequestIndicator, role]);

  useEffect(() => {
    const scheduleNotificationRefresh = () => {
      if (notificationRefreshTimerRef.current) return;
      notificationRefreshTimerRef.current = window.setTimeout(() => {
        notificationRefreshTimerRef.current = null;
        void loadUnreadNotificationsCount();
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
    loadUnreadNotificationsCount,
    refreshInstitutionRequestIndicator,
    role,
  ]);

  useEffect(() => {
    if (role !== 'INSTITUTION' || !path.startsWith('/institution/requests')) {
      return;
    }
    window.localStorage.setItem(INSTITUTION_REQUESTS_LAST_SEEN_KEY, String(Date.now()));
    setHasNewInstitutionRequests(false);
  }, [path, role]);

  useEffect(() => {
    setCollapsedFlyoutGroup(null);
  }, [location.pathname, sidebarCollapsed]);

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
            {navLinks.map(link => {
              const isNotificationsLink = link.to.endsWith('/notifications');
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
                            {childLinks.map(child => {
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
                            {childLinks.map((child, index) => {
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
                    {isNotificationsLink && unreadNotificationsCount > 0 && sidebarCollapsed && (
                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-error-500" />
                    )}
                  </span>
                  {!sidebarCollapsed && (
                    <span className="truncate flex-1">{link.label}</span>
                  )}
                  {!sidebarCollapsed && isNotificationsLink && unreadNotificationsCount > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-error-500 px-1.5 text-[10px] font-semibold text-white">
                      {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                    </span>
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

            <div className="mx-1 h-5 w-px bg-neutral-200" />

            {/* User avatar */}
            <div className="relative inline-flex items-center">
              <UserButton afterSignOutUrl="/" />
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
