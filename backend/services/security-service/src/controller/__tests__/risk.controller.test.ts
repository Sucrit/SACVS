import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const { mockRepository, mockWorker } = vi.hoisted(() => ({
  mockRepository: {
    listRiskEventRecords: vi.fn(),
    getRiskEventRecordById: vi.fn(),
    listReviewedRiskEventRecords: vi.fn(),
    updateRiskReviewStatus: vi.fn(),
  },
  mockWorker: {
    getStatus: vi.fn(),
  },
}));

vi.mock('../../repository/risk.repository', () => ({
  RiskRepository: vi.fn(() => mockRepository),
}));

vi.mock('../../runtime/shadow-risk.worker', () => ({
  shadowRiskWorker: mockWorker,
}));

import { RiskController } from '../risk.controller';

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
  res.send = vi.fn((body: unknown) => {
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

describe('RiskController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps missing review target in repository update to 404', async () => {
    const controller = new RiskController();
    const req = {
      params: { id: 'risk-1' },
      body: { reviewStatus: 'BENIGN' },
      auth: { sub: 'admin-1' },
    } as unknown as Request;
    const res = createResponseMock();
    const prismaLikeError = Object.assign(new Error('Record not found'), { code: 'P2025' });
    mockRepository.updateRiskReviewStatus.mockRejectedValue(prismaLikeError);

    await controller.updateRiskReviewStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Risk event not found.' });
  });

  it('returns 400 for invalid review reason code before repository call', async () => {
    const controller = new RiskController();
    const req = {
      params: { id: 'risk-1' },
      body: { reviewStatus: 'BENIGN', reviewReasonCode: 'WRONG' },
      auth: { sub: 'admin-1' },
    } as unknown as Request;
    const res = createResponseMock();

    await controller.updateRiskReviewStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid reviewReasonCode value.' });
    expect(mockRepository.updateRiskReviewStatus).not.toHaveBeenCalled();
  });

  it('maps unexpected repository failures in list to 500', async () => {
    const controller = new RiskController();
    const req = { query: {} } as unknown as Request;
    const res = createResponseMock();
    mockRepository.listRiskEventRecords.mockRejectedValue(new Error('DB_DOWN'));

    await controller.listRiskEvents(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
  });
});
