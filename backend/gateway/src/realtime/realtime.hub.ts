import { IncomingMessage } from 'node:http';
import type { Server } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import { ENV } from '../config/env';

type ActorRole = 'STUDENT' | 'ADMIN' | 'EMPLOYER' | 'INSTITUTION';

export interface RealtimeEventScope {
  broadcast?: boolean;
  roles?: ActorRole[];
  userIds?: string[];
  institutionIds?: string[];
  employerIds?: string[];
}

export interface RealtimeEventEnvelope {
  domain: 'users' | 'credentials' | 'credentialRequests' | 'notifications' | 'audit' | 'system';
  action: string;
  entityId?: string;
  occurredAt?: string;
  scope?: RealtimeEventScope;
  payload?: Record<string, unknown>;
}

type AuthContext = {
  userId: string;
  role: ActorRole;
  institutionId: string | null;
  employerId: string | null;
};

type ClientState = {
  socket: WebSocket;
  auth: AuthContext | null;
};

const AUTH_TIMEOUT_MS = 10000;

export class RealtimeHub {
  private wss: WebSocketServer | null = null;
  private clients = new Set<ClientState>();

  attach(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/realtime' });
    this.wss.on('connection', socket => this.handleConnection(socket));
  }

  publish(event: RealtimeEventEnvelope): void {
    const normalized: RealtimeEventEnvelope = {
      ...event,
      occurredAt: event.occurredAt || new Date().toISOString(),
    };

    const message = JSON.stringify({ type: 'event', event: normalized });
    for (const client of this.clients) {
      if (!client.auth) continue;
      if (!this.shouldDeliver(client.auth, normalized.scope)) continue;
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(message);
      }
    }
  }

  private handleConnection(socket: WebSocket): void {
    const state: ClientState = { socket, auth: null };
    this.clients.add(state);

    const authTimeout = setTimeout(() => {
      if (!state.auth && socket.readyState === WebSocket.OPEN) {
        socket.close(4001, 'AUTH_REQUIRED');
      }
    }, AUTH_TIMEOUT_MS);

    socket.on('message', raw => {
      void this.handleMessage(state, raw.toString());
    });

    socket.on('close', () => {
      clearTimeout(authTimeout);
      this.clients.delete(state);
    });

    socket.on('error', () => {
      clearTimeout(authTimeout);
      this.clients.delete(state);
    });
  }

  private async handleMessage(client: ClientState, raw: string): Promise<void> {
    let parsed: { type?: string; token?: string } | null = null;
    try {
      parsed = JSON.parse(raw) as { type?: string; token?: string };
    } catch {
      return;
    }
    if (!parsed) return;

    if (parsed.type === 'auth') {
      const token = typeof parsed.token === 'string' ? parsed.token.trim() : '';
      if (!token) {
        this.send(client.socket, { type: 'auth_error', error: 'TOKEN_REQUIRED' });
        return;
      }

      const auth = await this.resolveAuthContext(token);
      if (!auth) {
        this.send(client.socket, { type: 'auth_error', error: 'AUTH_FAILED' });
        client.socket.close(4003, 'AUTH_FAILED');
        return;
      }

      client.auth = auth;
      this.send(client.socket, { type: 'auth_ok' });
    }
  }

  private send(socket: WebSocket, payload: Record<string, unknown>): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }

  private async resolveAuthContext(token: string): Promise<AuthContext | null> {
    try {
      const response = await fetch(`${ENV.USER_SERVICE_URL}/users/me`, {
        method: 'GET',
        headers: {
          Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        },
      });
      if (!response.ok) return null;
      const body = (await response.json()) as {
        id?: string;
        role?: ActorRole;
        institutionId?: string | null;
        employerId?: string | null;
      };
      if (!body?.id || !body?.role) return null;
      if (!['STUDENT', 'ADMIN', 'EMPLOYER', 'INSTITUTION'].includes(body.role)) return null;
      return {
        userId: body.id,
        role: body.role,
        institutionId: body.institutionId ?? null,
        employerId: body.employerId ?? null,
      };
    } catch {
      return null;
    }
  }

  private shouldDeliver(auth: AuthContext, scope?: RealtimeEventScope): boolean {
    if (!scope) return true;
    if (scope.broadcast) return true;
    if (scope.userIds?.includes(auth.userId)) return true;
    if (scope.roles?.includes(auth.role)) return true;
    if (auth.institutionId && scope.institutionIds?.includes(auth.institutionId)) return true;
    if (auth.employerId && scope.employerIds?.includes(auth.employerId)) return true;
    return false;
  }
}

export const realtimeHub = new RealtimeHub();

export const isValidRealtimeEvent = (value: unknown): value is RealtimeEventEnvelope => {
  if (!value || typeof value !== 'object') return false;
  const event = value as RealtimeEventEnvelope;
  if (!event.domain || typeof event.domain !== 'string') return false;
  if (!event.action || typeof event.action !== 'string') return false;
  return true;
};

export const parseRealtimeEvents = (value: unknown): RealtimeEventEnvelope[] => {
  if (Array.isArray(value)) {
    return value.filter(isValidRealtimeEvent);
  }
  if (value && typeof value === 'object') {
    const payload = value as { events?: unknown };
    if (Array.isArray(payload.events)) {
      return payload.events.filter(isValidRealtimeEvent);
    }
    if (isValidRealtimeEvent(value)) {
      return [value];
    }
  }
  return [];
};

export const hasInternalEventAuth = (req: IncomingMessage): boolean => {
  const expected = ENV.INTERNAL_SERVICE_TOKEN?.trim();
  if (!expected) {
    return ENV.NODE_ENV !== 'production';
  }
  const header = req.headers['x-internal-service-token'];
  const provided = Array.isArray(header) ? header[0] : header;
  return typeof provided === 'string' && provided.trim() === expected;
};
