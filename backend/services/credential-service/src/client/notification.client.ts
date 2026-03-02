import { NotificationType } from '../../../../db/node_modules/@prisma/client';
import { ENV } from '../config/env';

interface CredentialIssueNotificationPayload {
  userId: string;
  credentialId: string;
  credentialType: string;
  credentialTitle: string;
  institutionName: string;
  isReissue: boolean;
}

interface CredentialStatusNotificationPayload {
  userId: string;
  credentialId: string;
  credentialType: string;
  credentialTitle: string;
  institutionName: string;
  previousStatus: string;
  nextStatus: string;
}

const parseRequiredBaseUrl = (value: string | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export class NotificationClient {
  async createSystemNotification(payload: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const baseUrl = parseRequiredBaseUrl(ENV.NOTIFICATION_SERVICE_URL);
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
        `Notification service returned ${response.status}: ${responseText}`,
      );
    }
  }

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
    const message = `Your ${payload.credentialType.toLowerCase()} "${payload.credentialTitle}" was ${actionLabel} by ${payload.institutionName}.`;
    await this.createSystemNotification({
      userId: payload.userId,
      type: NotificationType.CREDENTIAL_ISSUED,
      title: payload.isReissue ? 'Credential re-issued' : 'Credential issued',
      message,
      metadata: {
        credentialId: payload.credentialId,
        credentialTitle: payload.credentialTitle,
        credentialType: payload.credentialType,
        event: payload.isReissue ? 'REISSUED' : 'ISSUED',
        institutionName: payload.institutionName,
      },
    });
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

    const message = `Your ${payload.credentialType.toLowerCase()} "${payload.credentialTitle}" was ${statusNotification.verb} by ${payload.institutionName}.`;
    await this.createSystemNotification({
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
        institutionName: payload.institutionName,
      },
    });
  }
}

export const notificationClient = new NotificationClient();
