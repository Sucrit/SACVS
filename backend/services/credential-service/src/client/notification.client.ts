import { NotificationType } from '../../../../db/node_modules/@prisma/client';
import { ENV } from '../config/env';

interface CredentialIssueNotificationPayload {
  userId: string;
  credentialId: string;
  credentialType: string;
  credentialTitle: string;
  issuerDisplayName: string;
  isReissue: boolean;
}

const parseRequiredBaseUrl = (value: string | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export class NotificationClient {
  async sendCredentialIssuedNotification(payload: CredentialIssueNotificationPayload): Promise<void> {
    const baseUrl = parseRequiredBaseUrl(ENV.NOTIFICATION_SERVICE_URL);
    if (!baseUrl) {
      return;
    }

    const actionLabel = payload.isReissue ? 're-issued' : 'issued';
    const message = `Your ${payload.credentialType.toLowerCase()} credential "${payload.credentialTitle}" was ${actionLabel} by ${payload.issuerDisplayName}.`;

    const response = await fetch(`${baseUrl}/notifications/system`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ENV.INTERNAL_SERVICE_TOKEN
          ? { 'x-internal-service-token': ENV.INTERNAL_SERVICE_TOKEN }
          : {}),
      },
      body: JSON.stringify({
        userId: payload.userId,
        type: NotificationType.CREDENTIAL_ISSUED,
        title: payload.isReissue ? 'Credential re-issued' : 'Credential issued',
        message,
        metadata: {
          credentialId: payload.credentialId,
          credentialTitle: payload.credentialTitle,
          credentialType: payload.credentialType,
          event: payload.isReissue ? 'REISSUED' : 'ISSUED',
          issuerDisplayName: payload.issuerDisplayName,
        },
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `Notification service returned ${response.status} for credential notification: ${responseText}`,
      );
    }
  }
}

export const notificationClient = new NotificationClient();
