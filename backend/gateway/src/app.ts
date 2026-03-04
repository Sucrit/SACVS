import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import routes from './routes';
import { ENV } from './config/env';
import { hasInternalEventAuth, parseRealtimeEvents, realtimeHub } from './realtime/realtime.hub';

const app = express();
const jsonParser = express.json({ limit: '256kb' });
app.use((req, res, next) => {
  const path = req.path || '';
  const isProxiedRoute =
    path.startsWith('/users') ||
    path.startsWith('/credentials') ||
    path.startsWith('/notifications') ||
    path.startsWith('/blockchain');

  // Do not consume body on gateway for proxied service routes.
  if (isProxiedRoute) {
    return next();
  }

  return jsonParser(req, res, next);
});

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Correlation ID propagation
app.use((req, res, next) => {
  const incoming = req.header('x-correlation-id')?.trim();
  const correlationId = incoming && incoming.length > 0 ? incoming : crypto.randomUUID();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

// CORS
if (!ENV.CORS_ORIGIN) {
  app.use(cors());
} else {
  const allowed = ENV.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);
  const loopbackRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  const corsOptions = {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return cb(null, true);
      if (allowed.includes(origin)) return cb(null, true);
      if (ENV.NODE_ENV === 'development' && loopbackRegex.test(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'x-step-up-token', 'x-correlation-id'],
    credentials: true,
  };
  app.use(cors(corsOptions));
}

type RouteClass = 'PUBLIC_VERIFY' | 'HIGH_RISK_MUTATION' | 'INTERNAL' | 'STANDARD_AUTH';
type RatePolicy = {
  windowMs: number;
  maxRequests: number;
  burstMax: number;
  cooldownMs: number;
  blockDurationMs?: number;
};

type RateState = {
  count: number;
  burstCount: number;
  resetAt: number;
  cooldownUntil?: number;
  blockedUntil?: number;
  violations: number;
};

const RATE_POLICY: Record<RouteClass, RatePolicy> = {
  PUBLIC_VERIFY: {
    windowMs: 60_000,
    maxRequests: 30,
    burstMax: 10,
    cooldownMs: 30_000,
    blockDurationMs: 180_000,
  },
  HIGH_RISK_MUTATION: {
    windowMs: 60_000,
    maxRequests: 20,
    burstMax: 8,
    cooldownMs: 20_000,
    blockDurationMs: 120_000,
  },
  INTERNAL: {
    windowMs: 60_000,
    maxRequests: 120,
    burstMax: 30,
    cooldownMs: 10_000,
  },
  STANDARD_AUTH: {
    windowMs: 60_000,
    maxRequests: Math.max(20, ENV.RATE_LIMIT_MAX || 100),
    burstMax: Math.max(10, Math.floor((ENV.RATE_LIMIT_MAX || 100) / 4)),
    cooldownMs: 10_000,
  },
};

const rateState = new Map<string, RateState>();

const classifyRoute = (req: express.Request): RouteClass => {
  const path = req.path || req.originalUrl || '';
  const method = req.method.toUpperCase();

  if (path.startsWith('/credentials/verify/qr')) {
    return 'PUBLIC_VERIFY';
  }
  if (path.startsWith('/credentials/internal/') || path.startsWith('/notifications/system')) {
    return 'INTERNAL';
  }
  if (
    (method === 'PUT' && /^\/users\/[^/]+\/(role|status)$/.test(path)) ||
    (method === 'PUT' && /^\/credentials\/[^/]+\/issue$/.test(path)) ||
    (method === 'POST' && path === '/users/me/institution/students/bulk')
  ) {
    return 'HIGH_RISK_MUTATION';
  }

  return 'STANDARD_AUTH';
};

const identityPart = (req: express.Request): string => {
  const auth = req.header('authorization')?.trim();
  if (!auth) return 'anon';
  return crypto.createHash('sha1').update(auth).digest('hex').slice(0, 16);
};

app.use((req, res, next) => {
  const routeClass = classifyRoute(req);
  const policy = RATE_POLICY[routeClass];
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const key = `${routeClass}:${ip}:${identityPart(req)}`;
  const current = rateState.get(key);

  if (!current || now > current.resetAt) {
    rateState.set(key, {
      count: 1,
      burstCount: 1,
      resetAt: now + policy.windowMs,
      violations: current?.violations ?? 0,
    });
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, policy.maxRequests - 1)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + policy.windowMs) / 1000)));
    return next();
  }

  if (current.blockedUntil && now < current.blockedUntil) {
    res.setHeader('Retry-After', String(Math.ceil((current.blockedUntil - now) / 1000)));
    return res.status(429).json({ error: 'RATE_LIMITED' });
  }

  if (current.cooldownUntil && now < current.cooldownUntil) {
    res.setHeader('Retry-After', String(Math.ceil((current.cooldownUntil - now) / 1000)));
    return res.status(429).json({ error: 'RATE_LIMITED' });
  }

  current.count += 1;
  current.burstCount += 1;

  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, policy.maxRequests - current.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

  if (current.burstCount > policy.burstMax || current.count > policy.maxRequests) {
    current.violations += 1;
    current.cooldownUntil = now + policy.cooldownMs;
    if (policy.blockDurationMs && current.violations >= 3) {
      current.blockedUntil = now + policy.blockDurationMs;
    }

    const retryAt = current.blockedUntil && current.blockedUntil > current.cooldownUntil
      ? current.blockedUntil
      : current.cooldownUntil;
    if (retryAt) {
      res.setHeader('Retry-After', String(Math.ceil((retryAt - now) / 1000)));
    }

    return res.status(429).json({ error: 'RATE_LIMITED' });
  }

  return next();
});

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateState) {
    const expired =
      now > entry.resetAt &&
      (!entry.cooldownUntil || now > entry.cooldownUntil) &&
      (!entry.blockedUntil || now > entry.blockedUntil);
    if (expired) {
      rateState.delete(key);
    }
  }
}, 60_000);

const redactUrl = (rawUrl: string): string => {
  let value = rawUrl || '';
  value = value.replace(/(\/verify\/qr\/document\/)[^/?#]+/gi, '$1[REDACTED]');
  value = value.replace(/(\/verify\/qr\/)[^/?#]+/gi, '$1[REDACTED]');
  value = value.replace(/([?&](token|verificationUrl)=)[^&]+/gi, '$1[REDACTED]');
  return value;
};

// request logging
app.use((req, res, next) => {
  const start = Date.now();
  const correlationId = req.header('x-correlation-id') || 'n/a';
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] [corr=${correlationId}] ${req.method} ${redactUrl(req.originalUrl)} -> ${res.statusCode} (${duration}ms)`,
    );
  });
  next();
});

app.post('/internal/realtime/events', (req, res) => {
  if (!hasInternalEventAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const events = parseRealtimeEvents(req.body);
  if (events.length === 0) {
    return res.status(400).json({ error: 'Invalid event payload.' });
  }

  events.forEach(event => realtimeHub.publish(event));
  return res.status(202).json({ accepted: events.length });
});

app.use('/', routes);

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err?.status || err?.statusCode || 500;
  const message = err?.message || 'Internal Gateway Error';
  console.error(`[GATEWAY ERROR] ${status} - ${message}`);
  res.status(status).json({ error: message });
});

export default app;
