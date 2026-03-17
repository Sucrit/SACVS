export const appQueryKeys = {
  auth: {
    currentUser: () => ['auth', 'current-user'] as const,
  },
  layout: {
    unreadNotificationsCount: () => ['layout', 'unread-notifications-count'] as const,
    institutionPendingRequestIndicator: () => ['layout', 'institution-pending-request-indicator'] as const,
  },
  admin: {
    users: () => ['admin-users'] as const,
    notifications: () => ['admin-notifications'] as const,
    requests: () => ['admin-requests'] as const,
    auditLogs: () => ['admin-audit-logs'] as const,
    riskEventsRoot: () => ['admin-risk-events'] as const,
    riskEvents: (filters: {
      riskPage: number;
      riskPageSize: number;
      riskBandFilter: string;
      riskReviewFilter: string;
      reviewedOnly: boolean;
    }) => ['admin-risk-events', filters] as const,
    riskWorkerStatus: () => ['admin-risk-worker-status'] as const,
  },
  institution: {
    requests: () => ['institution-requests'] as const,
    credentials: () => ['institution-credentials'] as const,
    auditLogs: () => ['institution-audit-logs'] as const,
    students: () => ['institution-students'] as const,
    notifications: () => ['institution-notifications'] as const,
    credentialDetail: (credentialId: string) => ['institution-credential-detail', credentialId] as const,
  },
  student: {
    credentials: () => ['student-credentials'] as const,
    requests: () => ['student-requests'] as const,
    notifications: () => ['student-notifications'] as const,
    profile: () => ['student-profile'] as const,
  },
};
