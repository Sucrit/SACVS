import { NotificationType, Prisma } from '../../../../db/node_modules/@prisma/client';
import { ENV } from '../config/env';

interface CreateSystemNotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue | null;
}

const parseBaseUrl = (value: string | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export class NotificationClient {
  async createSystemNotification(payload: CreateSystemNotificationPayload): Promise<void> {
    const baseUrl = parseBaseUrl(ENV.NOTIFICATION_SERVICE_URL);
    if (!baseUrl) {
      return;
    }

    const response = await fetch(`${baseUrl}/notifications/system`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ENV.INTERNAL_SERVICE_TOKEN
          ? { 'x-internal-service-token': ENV.INTERNAL_SERVICE_TOKEN }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `Notification service returned ${response.status} while creating notification: ${responseText}`,
      );
    }
  }
}

export const notificationClient = new NotificationClient();

