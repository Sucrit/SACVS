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
};

