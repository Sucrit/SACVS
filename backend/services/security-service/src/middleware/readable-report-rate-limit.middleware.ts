import { NextFunction, Request, Response } from 'express';
import { ENV } from '../config/env';
import { AuthenticatedRequest } from './auth.middleware';

type RateEntry = {
  count: number;
  resetAt: number;
};

const rateState = new Map<string, RateEntry>();

function getAdminKey(req: Request): string | null {
  const auth = (req as AuthenticatedRequest).auth;
  return auth?.sub ?? null;
}

function pruneExpiredEntries(now: number) {
  for (const [key, entry] of rateState.entries()) {
    if (now >= entry.resetAt) {
      rateState.delete(key);
    }
  }
}

export function enforceReadableReportRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void {
  const adminKey = getAdminKey(req);
  if (!adminKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = Date.now();
  pruneExpiredEntries(now);

  const windowMs = ENV.AI_REPORT_RATE_LIMIT_WINDOW_MS;
  const maxRequests = ENV.AI_REPORT_RATE_LIMIT_MAX_REQUESTS;
  const entry = rateState.get(adminKey);

  if (!entry || now >= entry.resetAt) {
    rateState.set(adminKey, {
      count: 1,
      resetAt: now + windowMs,
    });
    return next();
  }

  if (entry.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: 'AI report generation is rate limited for this admin. Try again later.',
    });
  }

  entry.count += 1;
  return next();
}

export function __resetReadableReportRateLimitState() {
  rateState.clear();
}
