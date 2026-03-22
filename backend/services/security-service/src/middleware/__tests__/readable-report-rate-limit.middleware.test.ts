import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import {
  __resetReadableReportRateLimitState,
  enforceReadableReportRateLimit,
} from '../readable-report-rate-limit.middleware';

function createResponseMock() {
  const headers: Record<string, string> = {};
  const res: Partial<Response> & {
    statusCode?: number;
    body?: unknown;
    headers?: Record<string, string>;
  } = { headers };

  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res as Response;
  });
  res.setHeader = vi.fn((name: string, value: string) => {
    headers[name] = value;
    return res as Response;
  });

  return res as Response & {
    statusCode?: number;
    body?: unknown;
    headers: Record<string, string>;
  };
}

describe('enforceReadableReportRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T06:40:00.000Z'));
    __resetReadableReportRateLimitState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests within the per-admin limit', () => {
    const next = vi.fn() as unknown as NextFunction;

    for (let index = 0; index < 3; index += 1) {
      const req = { auth: { sub: 'admin-1' } } as unknown as Request;
      const res = createResponseMock();

      enforceReadableReportRateLimit(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(3);
  });

  it('blocks the fourth request for the same admin inside the rate-limit window', () => {
    const next = vi.fn() as unknown as NextFunction;

    for (let index = 0; index < 3; index += 1) {
      const req = { auth: { sub: 'admin-1' } } as unknown as Request;
      const res = createResponseMock();
      enforceReadableReportRateLimit(req, res, next);
    }

    const blockedReq = { auth: { sub: 'admin-1' } } as unknown as Request;
    const blockedRes = createResponseMock();
    enforceReadableReportRateLimit(blockedReq, blockedRes, next);

    expect(next).toHaveBeenCalledTimes(3);
    expect(blockedRes.status).toHaveBeenCalledWith(429);
    expect(blockedRes.json).toHaveBeenCalledWith({
      error: 'AI report generation is rate limited for this admin. Try again later.',
    });
    expect(blockedRes.headers['Retry-After']).toBeTruthy();
  });

  it('tracks different admins separately', () => {
    const next = vi.fn() as unknown as NextFunction;

    for (let index = 0; index < 3; index += 1) {
      enforceReadableReportRateLimit(
        { auth: { sub: 'admin-1' } } as unknown as Request,
        createResponseMock(),
        next,
      );
    }

    const otherAdminRes = createResponseMock();
    enforceReadableReportRateLimit(
      { auth: { sub: 'admin-2' } } as unknown as Request,
      otherAdminRes,
      next,
    );

    expect(next).toHaveBeenCalledTimes(4);
    expect(otherAdminRes.status).not.toHaveBeenCalled();
  });
});
