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

interface CredentialStatusNotificationPayload {
  userId: string;
  credentialId: string;
  credentialType: string;
  credentialTitle: string;
  issuerDisplayName: string;
  previousStatus: string;
  nextStatus: string;
}

const parseRequiredBaseUrl = (value: string | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export class NotificationClient {
  private resolveStatusNotification(
    status: string,
  ): { type: NotificationType; title: string; verb: string } | null {
    if (status === 'REVOKED') {
      return {
        type: NotificationType.CREDENTIAL_REVOKED,
        title: 'Credential revoked',
        verb: 'revoked',
      };
    }

    if (status === 'VERIFIED') {
      return {
        type: NotificationType.CREDENTIAL_VERIFIED,
        title: 'Credential verified',
        verb: 'verified',
      };
    }

    if (status === 'ISSUED') {
      return {
        type: NotificationType.CREDENTIAL_ISSUED,
        title: 'Credential issued',
        verb: 'issued',
      };
    }

    return null;
  }

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

  async sendCredentialStatusChangedNotification(
    payload: CredentialStatusNotificationPayload,
  ): Promise<void> {
    const baseUrl = parseRequiredBaseUrl(ENV.NOTIFICATION_SERVICE_URL);
    if (!baseUrl) {
      return;
    }

    const statusNotification = this.resolveStatusNotification(payload.nextStatus);
    if (!statusNotification) {
      return;
    }

    const message = `Your ${payload.credentialType.toLowerCase()} credential "${payload.credentialTitle}" was ${statusNotification.verb} by ${payload.issuerDisplayName}.`;

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
        type: statusNotification.type,
        title: statusNotification.title,
        message,
        metadata: {
          credentialId: payload.credentialId,
          credentialTitle: payload.credentialTitle,
          credentialType: payload.credentialType,
          event: 'STATUS_CHANGED',
          previousStatus: payload.previousStatus,
          nextStatus: payload.nextStatus,
          issuerDisplayName: payload.issuerDisplayName,
        },
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `Notification service returned ${response.status} for credential status notification: ${responseText}`,
      );
    }
  }
}

export const notificationClient = new NotificationClient();
