import { AppNotification } from '../../services/notification.service';

export const parseNotificationMetadataString = (
  metadata: Record<string, unknown> | null,
  key: string,
): string | null => {
  if (!metadata) return null;
  const value = metadata[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

export const getNotificationMetadataEvent = (
  notification: AppNotification,
): string | null => parseNotificationMetadataString(notification.metadata, 'event');