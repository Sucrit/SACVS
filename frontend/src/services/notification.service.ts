import { api } from '../api/client';

export type NotificationType =
  | 'ACCOUNT_APPROVED'
  | 'ACCOUNT_REJECTED'
  | 'CREDENTIAL_ISSUED'
  | 'CREDENTIAL_VERIFIED'
  | 'CREDENTIAL_REVOKED'
  | 'CREDENTIAL_REQUEST_UPDATE'
  | 'SECURITY_ALERT'
  | 'SYSTEM_ANNOUNCEMENT';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: AppNotification[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export type InstitutionNotificationTarget = 'ALL' | 'APPROVED_ONLY' | 'SUSPENDED_ONLY';

export interface InstitutionNotificationBroadcast {
  id: string;
  target: InstitutionNotificationTarget;
  title: string;
  message: string;
  recipientCount: number;
  createdAt: string;
  createdByName: string;
  createdByEmail: string;
}

interface NotificationDisplayOptions {
  institutionNameFallback?: string | null;
}

const parseMetadataString = (
  metadata: Record<string, unknown> | null,
  key: string,
): string | null => {
  if (!metadata) return null;
  const value = metadata[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

const stripEmailDetails = (message: string): string =>
  message.replace(/\s*\([^)]+@[^)]+\)/g, '');

export const getNotificationDisplayMessage = (
  notification: AppNotification,
  options: NotificationDisplayOptions = {},
): string => {
  const credentialType = parseMetadataString(notification.metadata, 'credentialType')?.toLowerCase();
  const credentialTitle = parseMetadataString(notification.metadata, 'credentialTitle');
  const event = parseMetadataString(notification.metadata, 'event');
  const institutionName =
    parseMetadataString(notification.metadata, 'institutionName') ||
    (options.institutionNameFallback?.trim() || null) ||
    'the institution';

  if (
    credentialType &&
    notification.type === 'CREDENTIAL_ISSUED' &&
    (event === 'ISSUED' || event === 'REISSUED')
  ) {
    const action = event === 'REISSUED' ? 're-issued' : 'issued';
    if (credentialTitle) {
      return `Your ${credentialType} "${credentialTitle}" was ${action} by ${institutionName}.`;
    }
    return `Your ${credentialType} was ${action} by ${institutionName}.`;
  }

  if (credentialType && notification.type === 'CREDENTIAL_REVOKED') {
    if (credentialTitle) {
      return `Your ${credentialType} "${credentialTitle}" was revoked by ${institutionName}.`;
    }
    return `Your ${credentialType} was revoked by ${institutionName}.`;
  }

  if (credentialType && notification.type === 'CREDENTIAL_VERIFIED') {
    if (credentialTitle) {
      return `Your ${credentialType} "${credentialTitle}" was verified by ${institutionName}.`;
    }
    return `Your ${credentialType} credential was verified by ${institutionName}.`;
  }

  return stripEmailDetails(notification.message);
};

export const NotificationService = {
  list: async (query: { read?: boolean; page?: number; pageSize?: number } = {}) => {
    const response = await api.get<NotificationListResponse>('/notifications', { params: query });
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get<{ unreadCount: number }>('/notifications/unread-count');
    return response.data.unreadCount;
  },

  markRead: async (id: string, read = true) => {
    const response = await api.patch<AppNotification>(`/notifications/${id}/read`, { read });
    return response.data;
  },

  markAllRead: async () => {
    const response = await api.patch<{ updatedCount: number }>('/notifications/read-all');
    return response.data;
  },

  listInstitutionBroadcasts: async () => {
    const response = await api.get<{ items: InstitutionNotificationBroadcast[] }>(
      '/notifications/institution-broadcasts',
    );
    return response.data.items;
  },

  createInstitutionBroadcast: async (payload: {
    target: InstitutionNotificationTarget;
    title: string;
    message: string;
  }) => {
    const response = await api.post<InstitutionNotificationBroadcast>(
      '/notifications/institution-broadcast',
      payload,
    );
    return response.data;
  },
};
