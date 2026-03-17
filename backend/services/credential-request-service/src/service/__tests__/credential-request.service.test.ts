import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRepository,
  mockNotificationClient,
  mockRealtimeClient,
} = vi.hoisted(() => ({
  mockRepository: {
    getUserContextById: vi.fn(),
    getCredentialRequestScopeById: vi.fn(),
    updateCredentialRequestStatus: vi.fn(),
    createAuditLog: vi.fn(),
    listInstitutionNotificationRecipients: vi.fn(),
    listCredentialRequests: vi.fn(),
    createCredentialRequest: vi.fn(),
    getCredentialRequestById: vi.fn(),
    invalidateActiveApprovalReceiptsForRequest: vi.fn(),
    createApprovalReceiptForApprovedRequest: vi.fn(),
    consumeApprovalReceiptTokenAtomically: vi.fn(),
    findApprovalReceiptByCode: vi.fn(),
  },
  mockNotificationClient: {
    createSystemNotification: vi.fn(),
  },
  mockRealtimeClient: {
    publishMany: vi.fn(),
  },
}));

vi.mock('../../repository/credential-request.repository', () => ({
  CredentialRequestRepository: vi.fn(() => mockRepository),
}));

vi.mock('../../client/notification.client', () => ({
  notificationClient: mockNotificationClient,
}));

vi.mock('../../client/realtime.client', () => ({
  realtimeClient: mockRealtimeClient,
}));

import { CredentialRequestService } from '../credential-request.service';

describe('CredentialRequestService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository.createAuditLog.mockResolvedValue(undefined);
    mockRepository.invalidateActiveApprovalReceiptsForRequest.mockResolvedValue(0);
    mockRepository.listInstitutionNotificationRecipients.mockResolvedValue([]);
    mockNotificationClient.createSystemNotification.mockResolvedValue(undefined);
    mockRealtimeClient.publishMany.mockResolvedValue(undefined);
  });

  it('allows students to cancel their own pending requests only', async () => {
    const service = new CredentialRequestService();
    mockRepository.getUserContextById.mockResolvedValue({
      id: 'student-1',
      role: 'STUDENT',
      status: 'APPROVED',
      firstName: 'Sucrit',
      middleName: null,
      lastName: 'Cal',
      email: 'student@example.com',
      institutionId: 'inst-1',
    });
    mockRepository.getCredentialRequestScopeById.mockResolvedValue({
      id: 'req-1',
      studentId: 'student-1',
      credentialId: null,
      requesterId: 'student-1',
      status: 'PENDING',
      institutionId: 'inst-1',
      deliveryMethod: 'DIGITAL',
      processedAt: null,
      type: 'TRANSCRIPT',
      student: {
        institutionId: 'inst-1',
        firstName: 'Sucrit',
        middleName: null,
        lastName: 'Cal',
        profile: { studentNumber: '2020-10001' },
      },
      institution: { institutionName: 'XYC University' },
    });
    mockRepository.updateCredentialRequestStatus.mockResolvedValue({
      id: 'req-1',
      studentId: 'student-1',
      institutionId: 'inst-1',
      credentialId: null,
      requesterId: 'student-1',
      title: 'Transcript Request',
      description: 'Need a transcript',
      purpose: 'Employment',
      deliveryMethod: 'DIGITAL',
      type: 'TRANSCRIPT',
      status: 'CANCELLED',
      processedById: null,
      processedAt: null,
      rejectionReason: null,
      requestType: 'STUDENT',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-02T00:00:00.000Z'),
    });

    const result = await service.updateCredentialRequestStatus('student-1', 'req-1', {
      status: 'CANCELLED',
    });

    expect(result.status).toBe('CANCELLED');
    expect(mockRepository.updateCredentialRequestStatus).toHaveBeenCalledWith(
      'req-1',
      expect.objectContaining({
        status: 'CANCELLED',
        processedById: null,
        processedAt: null,
      }),
    );
    expect(mockRealtimeClient.publishMany).toHaveBeenCalled();
  });

  it('blocks students from changing requests to non-cancel statuses', async () => {
    const service = new CredentialRequestService();
    mockRepository.getUserContextById.mockResolvedValue({
      id: 'student-1',
      role: 'STUDENT',
      status: 'APPROVED',
      firstName: 'Sucrit',
      middleName: null,
      lastName: 'Cal',
      email: 'student@example.com',
      institutionId: 'inst-1',
    });
    mockRepository.getCredentialRequestScopeById.mockResolvedValue({
      id: 'req-1',
      studentId: 'student-1',
      credentialId: null,
      requesterId: 'student-1',
      status: 'PENDING',
      institutionId: 'inst-1',
      deliveryMethod: 'DIGITAL',
      processedAt: null,
      type: 'TRANSCRIPT',
      student: {
        institutionId: 'inst-1',
        firstName: 'Sucrit',
        middleName: null,
        lastName: 'Cal',
        profile: { studentNumber: '2020-10001' },
      },
      institution: { institutionName: 'XYC University' },
    });

    await expect(
      service.updateCredentialRequestStatus('student-1', 'req-1', {
        status: 'APPROVED',
      }),
    ).rejects.toThrow('FORBIDDEN_STATUS_FOR_ROLE');
  });

  it('requires rejection reason for managed rejections', async () => {
    const service = new CredentialRequestService();
    mockRepository.getUserContextById.mockResolvedValue({
      id: 'institution-1',
      role: 'INSTITUTION',
      status: 'APPROVED',
      firstName: 'Mobi',
      middleName: null,
      lastName: 'Smith',
      email: 'institution@example.edu',
      institutionId: 'inst-1',
    });
    mockRepository.getCredentialRequestScopeById.mockResolvedValue({
      id: 'req-1',
      studentId: 'student-1',
      credentialId: null,
      requesterId: 'student-1',
      status: 'PENDING',
      institutionId: 'inst-1',
      deliveryMethod: 'DIGITAL',
      processedAt: null,
      type: 'TRANSCRIPT',
      student: {
        institutionId: 'inst-1',
        firstName: 'Sucrit',
        middleName: null,
        lastName: 'Cal',
        profile: { studentNumber: '2020-10001' },
      },
      institution: { institutionName: 'XYC University' },
    });

    await expect(
      service.updateCredentialRequestStatus('institution-1', 'req-1', {
        status: 'REJECTED',
      }),
    ).rejects.toThrow('REJECTION_REASON_REQUIRED');
  });

  it('generates approval receipts for approved physical delivery requests', async () => {
    const service = new CredentialRequestService();
    mockRepository.getUserContextById.mockResolvedValue({
      id: 'institution-1',
      role: 'INSTITUTION',
      status: 'APPROVED',
      firstName: 'Mobi',
      middleName: null,
      lastName: 'Smith',
      email: 'institution@example.edu',
      institutionId: 'inst-1',
    });
    mockRepository.getCredentialRequestScopeById.mockResolvedValue({
      id: 'req-1',
      studentId: 'student-1',
      credentialId: null,
      requesterId: 'student-1',
      status: 'PENDING',
      institutionId: 'inst-1',
      deliveryMethod: 'PHYSICAL',
      processedAt: null,
      type: 'TRANSCRIPT',
      student: {
        institutionId: 'inst-1',
        firstName: 'Sucrit',
        middleName: null,
        lastName: 'Cal',
        profile: { studentNumber: '2020-10001' },
      },
      institution: { institutionName: 'XYC University' },
    });
    mockRepository.updateCredentialRequestStatus.mockResolvedValue({
      id: 'req-1',
      studentId: 'student-1',
      institutionId: 'inst-1',
      credentialId: null,
      requesterId: 'student-1',
      title: 'Transcript Request',
      description: 'Need a transcript',
      purpose: 'Employment',
      deliveryMethod: 'PHYSICAL',
      type: 'TRANSCRIPT',
      status: 'APPROVED',
      processedById: 'institution-1',
      processedAt: new Date('2026-03-02T00:00:00.000Z'),
      rejectionReason: null,
      requestType: 'STUDENT',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-02T00:00:00.000Z'),
    });
    mockRepository.createApprovalReceiptForApprovedRequest.mockResolvedValue({
      request: {
        id: 'req-1',
        studentId: 'student-1',
        credentialId: null,
        requesterId: 'student-1',
        status: 'APPROVED',
        institutionId: 'inst-1',
        deliveryMethod: 'PHYSICAL',
        processedAt: new Date('2026-03-02T00:00:00.000Z'),
        type: 'TRANSCRIPT',
        student: {
          institutionId: 'inst-1',
          firstName: 'Sucrit',
          middleName: null,
          lastName: 'Cal',
          profile: { studentNumber: '2020-10001' },
        },
        institution: { institutionName: 'XYC University' },
      },
      receipt: {
        id: 'receipt-1',
        receiptCode: 'APR-1234ABCD',
      },
    });

    await service.updateCredentialRequestStatus('institution-1', 'req-1', {
      status: 'APPROVED',
    });

    expect(mockRepository.createApprovalReceiptForApprovedRequest).toHaveBeenCalled();
    expect(mockNotificationClient.createSystemNotification).toHaveBeenCalled();
    expect(mockRealtimeClient.publishMany).toHaveBeenCalled();
  });

  it('blocks physical claim completion for BOTH delivery before digital issuance', async () => {
    const service = new CredentialRequestService();
    mockRepository.getUserContextById.mockResolvedValue({
      id: 'institution-1',
      role: 'INSTITUTION',
      status: 'APPROVED',
      firstName: 'Mobi',
      middleName: null,
      lastName: 'Smith',
      email: 'institution@example.edu',
      institutionId: 'inst-1',
    });
    mockRepository.getCredentialRequestScopeById.mockResolvedValue({
      id: 'req-1',
      studentId: 'student-1',
      credentialId: null,
      requesterId: 'student-1',
      status: 'APPROVED',
      institutionId: 'inst-1',
      deliveryMethod: 'BOTH',
      processedAt: new Date('2026-03-02T00:00:00.000Z'),
      type: 'TRANSCRIPT',
      student: {
        institutionId: 'inst-1',
        firstName: 'Sucrit',
        middleName: null,
        lastName: 'Cal',
        profile: { studentNumber: '2020-10001' },
      },
      institution: { institutionName: 'XYC University' },
    });

    await expect(
      service.markPhysicalClaimed('institution-1', 'req-1'),
    ).rejects.toThrow('DIGITAL_ISSUANCE_REQUIRED_BEFORE_PHYSICAL_CLAIM');
  });

  it('enforces receipt access scope checks', async () => {
    const service = new CredentialRequestService();
    mockRepository.getUserContextById.mockResolvedValue({
      id: 'institution-2',
      role: 'INSTITUTION',
      status: 'APPROVED',
      firstName: 'Other',
      middleName: null,
      lastName: 'Institution',
      email: 'other@example.edu',
      institutionId: 'inst-2',
    });
    mockRepository.getCredentialRequestScopeById.mockResolvedValue({
      id: 'req-1',
      studentId: 'student-1',
      credentialId: null,
      requesterId: 'student-1',
      status: 'APPROVED',
      institutionId: 'inst-1',
      deliveryMethod: 'PHYSICAL',
      processedAt: new Date('2026-03-02T00:00:00.000Z'),
      type: 'TRANSCRIPT',
      student: {
        institutionId: 'inst-1',
        firstName: 'Sucrit',
        middleName: null,
        lastName: 'Cal',
        profile: { studentNumber: '2020-10001' },
      },
      institution: { institutionName: 'XYC University' },
    });

    await expect(service.getApprovalReceipt('institution-2', 'req-1')).rejects.toThrow('FORBIDDEN_SCOPE');
  });

  it('returns invalid for malformed verification tokens and audits the attempt', async () => {
    const service = new CredentialRequestService();

    const result = await service.verifyApprovalReceiptToken('short-token');

    expect(result).toEqual({ valid: false, reason: 'INVALID', receipt: null });
    expect(mockRepository.createAuditLog).toHaveBeenCalled();
  });

  it('returns receipt context for valid verification tokens', async () => {
    const service = new CredentialRequestService();
    mockRepository.consumeApprovalReceiptTokenAtomically.mockResolvedValue({
      outcome: 'VALID',
      receipt: {
        receiptId: 'receipt-1',
        requestId: 'req-1',
        receiptCode: 'APR-1234ABCD',
        studentName: 'Sucrit Cal',
        studentNumber: '2020-10001',
        type: 'TRANSCRIPT',
        deliveryMethod: 'PHYSICAL',
        approvedAt: new Date('2026-03-02T00:00:00.000Z'),
        institutionName: 'XYC University',
      },
    });

    const result = await service.verifyApprovalReceiptToken('12345678901234567890-token');

    expect(result.valid).toBe(true);
    expect(result.receipt).toMatchObject({
      receiptCode: 'APR-1234ABCD',
      requestId: 'req-1',
    });
  });

  it('returns lookup-only not found for malformed receipt codes', async () => {
    const service = new CredentialRequestService();

    const result = await service.lookupReceiptByCode('bad-code');

    expect(result).toEqual({ found: false, lookupOnly: true, receipt: null });
    expect(mockRepository.findApprovalReceiptByCode).not.toHaveBeenCalled();
  });

  it('returns lookup-only receipt data for valid receipt codes', async () => {
    const service = new CredentialRequestService();
    mockRepository.findApprovalReceiptByCode.mockResolvedValue({
      tokenStatus: 'USED',
      receipt: {
        receiptId: 'receipt-1',
        requestId: 'req-1',
        receiptCode: 'APR-1234ABCD',
        studentName: 'Sucrit Cal',
        studentNumber: '2020-10001',
        type: 'TRANSCRIPT',
        deliveryMethod: 'PHYSICAL',
        approvedAt: new Date('2026-03-02T00:00:00.000Z'),
        institutionName: 'XYC University',
      },
    });

    const result = await service.lookupReceiptByCode('apr-1234abcd');

    expect(result).toMatchObject({
      found: true,
      lookupOnly: true,
      tokenStatus: 'USED',
      receipt: {
        receiptCode: 'APR-1234ABCD',
        requestId: 'req-1',
      },
    });
  });
});
