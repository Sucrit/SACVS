import { ENV } from '../config/env';

type Role = 'STUDENT' | 'ADMIN' | 'INSTITUTION';

export interface RealtimeEvent {
  domain: 'users' | 'credentials' | 'credentialRequests' | 'notifications' | 'audit' | 'system';
  action: string;
  entityId?: string;
  scope?: {
    broadcast?: boolean;
    roles?: Role[];
    userIds?: string[];
    institutionIds?: string[];
  };
  payload?: Record<string, unknown>;
}

const parseBaseUrl = (value: string | undefined): string => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:4900';
};

export class RealtimeClient {
  async publishMany(events: RealtimeEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
      const response = await fetch(`${parseBaseUrl(ENV.REALTIME_GATEWAY_URL)}/internal/realtime/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(ENV.INTERNAL_SERVICE_TOKEN
            ? { 'x-internal-service-token': ENV.INTERNAL_SERVICE_TOKEN }
            : {}),
        },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Realtime gateway returned ${response.status}: ${text}`);
      }
    } catch (error) {
      console.error('Failed to publish realtime event(s) from credential-request-service:', error);
    }
  }
}

export const realtimeClient = new RealtimeClient();

