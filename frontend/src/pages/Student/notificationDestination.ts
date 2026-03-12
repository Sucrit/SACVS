import { AppNotification } from '../../services/notification.service';
import {
  parseNotificationMetadataString,
} from '../../components/notifications/notificationMetadata';

export type StudentNotificationDestination =
  | { kind: 'credential'; credentialId: string }
  | { kind: 'request'; requestId: string }
  | { kind: 'notifications' };

export const resolveStudentNotificationDestination = (
  notification: AppNotification,
): StudentNotificationDestination => {
  const credentialId = parseNotificationMetadataString(notification.metadata, 'credentialId');
  if (credentialId) {
    return { kind: 'credential', credentialId };
  }

  const requestId = parseNotificationMetadataString(notification.metadata, 'requestId');
  if (requestId) {
    return { kind: 'request', requestId };
  }

  return { kind: 'notifications' };
};