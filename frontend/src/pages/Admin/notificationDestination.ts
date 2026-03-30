import { AppNotification } from '../../services/notification.service';
import {
  parseNotificationMetadataString,
} from '../../components/notifications/notificationMetadata';

export type AdminNotificationDestination =
  | {
      kind: 'risk';
      riskEventId: string | null;
      targetId: string | null;
      actorId: string | null;
    }
  | {
      kind: 'users';
      userId: string | null;
      roleFilter?: 'INSTITUTION' | 'ADMIN' | 'STUDENT' | null;
      statusFilter?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | null;
    }
  | { kind: 'notifications' };

export const resolveAdminNotificationDestination = (
  notification: AppNotification,
): AdminNotificationDestination => {
  const riskEventId =
    parseNotificationMetadataString(notification.metadata, 'riskEventId') ||
    parseNotificationMetadataString(notification.metadata, 'eventId');
  const requestId = parseNotificationMetadataString(notification.metadata, 'requestId');
  const credentialId = parseNotificationMetadataString(notification.metadata, 'credentialId');
  const actorId = parseNotificationMetadataString(notification.metadata, 'actorId');
  const userId =
    parseNotificationMetadataString(notification.metadata, 'studentId') ||
    parseNotificationMetadataString(notification.metadata, 'processedById') ||
    parseNotificationMetadataString(notification.metadata, 'userId');
  const event = parseNotificationMetadataString(notification.metadata, 'event');
  const targetId =
    parseNotificationMetadataString(notification.metadata, 'targetId') ||
    credentialId ||
    requestId;

  if (notification.type === 'SECURITY_ALERT') {
    return { kind: 'risk', riskEventId, targetId, actorId };
  }

  if (notification.type === 'ACCOUNT_APPROVED' || notification.type === 'ACCOUNT_REJECTED') {
    return { kind: 'users', userId };
  }

  if (event === 'INSTITUTION_ACCOUNT_REQUEST_CREATED') {
    return {
      kind: 'users',
      userId,
      roleFilter: 'INSTITUTION',
      statusFilter: 'PENDING',
    };
  }

  if (riskEventId || targetId || actorId) {
    return { kind: 'risk', riskEventId, targetId, actorId };
  }

  if (userId) {
    return { kind: 'users', userId };
  }

  return { kind: 'notifications' };
};
