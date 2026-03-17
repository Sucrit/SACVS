import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const { mockService } = vi.hoisted(() => ({
  mockService: {
    listCredentialRequests: vi.fn(),
    createCredentialRequest: vi.fn(),
    getCredentialRequestById: vi.fn(),
    updateCredentialRequestStatus: vi.fn(),
    getApprovalReceipt: vi.fn(),
    verifyApprovalReceiptToken: vi.fn(),
    lookupReceiptByCode: vi.fn(),
    markPhysicalClaimed: vi.fn(),
  },
}));

vi.mock('../../service/credential-request.service', () => ({
  CredentialRequestService: vi.fn(() => mockService),
}));

import { CredentialRequestController } from '../credential-request.controller';

function createResponseMock() {
  const res: Partial<Response> & {
    statusCode?: number;
    body?: unknown;
  } = {};

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

  return res as Response & { statusCode?: number; body?: unknown };
}

describe('CredentialRequestController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps invalid list status to 400', async () => {
    const controller = new CredentialRequestController();
    const req = {
      query: { status: 'WRONG' },
      auth: { sub: 'user-1' },
    } as unknown as Request;
    const res = createResponseMock();

    await controller.listCredentialRequests(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid status query value.' });
    expect(mockService.listCredentialRequests).not.toHaveBeenCalled();
  });

  it('maps request status update not found to 404', async () => {
    const controller = new CredentialRequestController();
    const req = {
      params: { id: 'req-1' },
      body: { status: 'APPROVED' },
      auth: { sub: 'institution-1' },
    } as unknown as Request;
    const res = createResponseMock();
    mockService.updateCredentialRequestStatus.mockRejectedValue(new Error('REQUEST_NOT_FOUND'));

    await controller.updateCredentialRequestStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Credential request not found.' });
  });

  it('maps approval receipt forbidden scope to 403', async () => {
    const controller = new CredentialRequestController();
    const req = {
      params: { id: 'req-1' },
      auth: { sub: 'institution-1' },
    } as unknown as Request;
    const res = createResponseMock();
    mockService.getApprovalReceipt.mockRejectedValue(new Error('FORBIDDEN_SCOPE'));

    await controller.getApprovalReceipt(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Not allowed to access this approval receipt.',
    });
  });

  it('maps physical claim digital issuance prerequisite to 400', async () => {
    const controller = new CredentialRequestController();
    const req = {
      params: { id: 'req-1' },
      body: { notes: 'claimed' },
      auth: { sub: 'institution-1' },
    } as unknown as Request;
    const res = createResponseMock();
    mockService.markPhysicalClaimed.mockRejectedValue(
      new Error('DIGITAL_ISSUANCE_REQUIRED_BEFORE_PHYSICAL_CLAIM'),
    );

    await controller.markPhysicalClaimed(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'For BOTH delivery, issue/link the digital credential before marking physical claim.',
    });
  });
});
