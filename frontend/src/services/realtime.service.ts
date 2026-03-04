type RealtimeDomain = 'users' | 'credentials' | 'credentialRequests' | 'notifications' | 'audit' | 'system';

export interface RealtimeEventEnvelope {
  domain: RealtimeDomain;
  action: string;
  entityId?: string;
  occurredAt?: string;
  payload?: Record<string, unknown>;
}

type RealtimeMessage =
  | { type: 'auth_ok' }
  | { type: 'auth_error'; error?: string }
  | { type: 'event'; event: RealtimeEventEnvelope };

type Listener = (event: RealtimeEventEnvelope) => void;

const parseGatewayBase = (): string => {
  const configured = [import.meta.env.VITE_GATEWAY_URL, import.meta.env.VITE_API_URL].find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
  if (!configured) {
    throw new Error('Missing realtime gateway URL: set VITE_GATEWAY_URL in frontend/.env');
  }

  const normalized = configured.trim().replace(/\/+$/, '');
  if (normalized.startsWith('https://')) return normalized.replace('https://', 'wss://');
  if (normalized.startsWith('http://')) return normalized.replace('http://', 'ws://');
  throw new Error('Invalid realtime gateway URL: must start with http:// or https://');
};

export class RealtimeService {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private tokenProvider: (() => Promise<string | null>) | null = null;
  private listeners = new Set<Listener>();
  private active = false;

  start(tokenProvider: () => Promise<string | null>): void {
    this.tokenProvider = tokenProvider;
    this.active = true;
    this.connect();
  }

  stop(): void {
    this.active = false;
    this.tokenProvider = null;
    this.clearReconnectTimer();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.active) return;
    this.clearReconnectTimer();
    const delay = Math.min(15000, 1000 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }

  private connect(): void {
    if (!this.active || this.socket) return;
    const socket = new WebSocket(`${parseGatewayBase()}/realtime`);
    this.socket = socket;

    socket.onopen = async () => {
      try {
        const token = await this.tokenProvider?.();
        if (!token) {
          socket.close(4003, 'AUTH_TOKEN_MISSING');
          return;
        }
        socket.send(JSON.stringify({ type: 'auth', token }));
      } catch {
        socket.close(4003, 'AUTH_TOKEN_ERROR');
      }
    };

    socket.onmessage = event => {
      let parsed: RealtimeMessage | null = null;
      try {
        parsed = JSON.parse(event.data as string) as RealtimeMessage;
      } catch {
        return;
      }
      if (!parsed) return;
      if (parsed.type === 'auth_ok') {
        this.reconnectAttempt = 0;
        return;
      }
      if (parsed.type === 'auth_error') {
        return;
      }
      if (parsed.type === 'event' && parsed.event) {
        this.listeners.forEach(listener => listener(parsed.event));
      }
    };

    socket.onerror = () => {
      // Close handler will trigger reconnect.
    };

    socket.onclose = () => {
      this.socket = null;
      this.scheduleReconnect();
    };
  }
}

export const realtimeService = new RealtimeService();
