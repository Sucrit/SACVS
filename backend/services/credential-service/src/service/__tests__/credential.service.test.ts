import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRepository,
  mockNotificationClient,
  mockRealtimeClient,
  mockBlockchainClient,
} = vi.hoisted(() => ({
  mockRepository: {
    listDueIssuedCredentialsForAutoExpiry: vi.fn(),
    markCredentialAsExpiredIfDue: vi.fn(),
    createAuditLog: vi.fn(),
    getCredentialScopeById: vi.fn(),
    updateCredential: vi.fn(),
    getCredentialById: vi.fn(),
    getCredentialForAiDocument: vi.fn(),
    invalidateActiveQrTokens: vi.fn(),
  },
  mockNotificationClient: {
    sendCredentialIssuedNotification: vi.fn(),
    sendCredentialStatusChangedNotification: vi.fn(),
  },
  mockRealtimeClient: {
    publishMany: vi.fn(),
  },
  mockBlockchainClient: {
    anchorCredential: vi.fn(),
    revokeCredential: vi.fn(),
  },
}));

vi.mock('../../repository/credential.repository', () => ({
  CredentialRepository: vi.fn(() => mockRepository),
}));

vi.mock('../../client/notification.client', () => ({
  notificationClient: mockNotificationClient,
}));

vi.mock('../../client/realtime.client', () => ({
  realtimeClient: mockRealtimeClient,
}));

vi.mock('../../client/blockchain.client', () => ({
  blockchainClient: mockBlockchainClient,
}));

import { CredentialService } from '../credential.service';

const buildScope = (overrides: Record<string, unknown> = {}) => ({
  id: 'cred-1',
  title: 'Transcript',
  type: 'TRANSCRIPT',
  status: 'PENDING',
  issuedById: 'institution-user-1',
  studentId: 'student-1',
  fileHash: 'hash-1',
  chain: null,
  txHash: null,
  blockNumber: null,
  anchoredAt: null,
  issuedDate: null,
  expiryDate: null,
  metadata: null,
  student: {
    institutionId: 'inst-1',
  },
  ...overrides,
});

const buildUpdatedCredential = (overrides: Record<string, unknown> = {}) => ({
  id: 'cred-1',
  studentId: 'student-1',
  title: 'Transcript',
  type: 'TRANSCRIPT',
  status: 'ISSUED',
  issuedBy: {
    firstName: 'Mobi',
    middleName: null,
    lastName: 'Smith',
    email: 'institution@example.edu',
    institution: {
      institutionName: 'XYC University',
    },
  },
  student: {
    institutionId: 'inst-1',
  },
  ...overrides,
});

describe('CredentialService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository.listDueIssuedCredentialsForAutoExpiry.mockResolvedValue([]);
    mockRepository.createAuditLog.mockResolvedValue(undefined);
    mockRepository.updateCredential.mockResolvedValue(buildUpdatedCredential());
    mockNotificationClient.sendCredentialIssuedNotification.mockResolvedValue(undefined);
    mockNotificationClient.sendCredentialStatusChangedNotification.mockResolvedValue(undefined);
    mockRealtimeClient.publishMany.mockResolvedValue(undefined);
    mockBlockchainClient.anchorCredential.mockResolvedValue({
      chain: 'POLYGON',
      txHash: '0xabc',
      blockNumber: 12,
      anchoredAt: '2026-03-02T00:00:00.000Z',
    });
    mockBlockchainClient.revokeCredential.mockResolvedValue(undefined);
  });

  it('rejects forbidden roles before touching credential data', async () => {
    const service = new CredentialService();

    await expect(
      service.updateCredentialStatus(
        { userId: 'student-1', role: 'STUDENT', institutionId: 'inst-1' },
        'cred-1',
        { status: 'ISSUED' },
      ),
    ).rejects.toThrow('FORBIDDEN_ROLE');

    expect(mockRepository.getCredentialScopeById).not.toHaveBeenCalled();
  });

  it('rejects forbidden scope for institution actors', async () => {
    const service = new CredentialService();
    mockRepository.getCredentialScopeById.mockResolvedValue(
      buildScope({ issuedById: 'other-user', student: { institutionId: 'inst-2' } }),
    );

    await expect(
      service.updateCredentialStatus(
        { userId: 'institution-user-1', role: 'INSTITUTION', institutionId: 'inst-1' },
        'cred-1',
        { status: 'ISSUED' },
      ),
    ).rejects.toThrow('FORBIDDEN_SCOPE');
  });

  it('rejects unchanged statuses when no-op updates are not allowed', async () => {
    const service = new CredentialService();
    mockRepository.getCredentialScopeById.mockResolvedValue(buildScope({ status: 'PENDING' }));

    await expect(
      service.updateCredentialStatus(
        { userId: 'admin-1', role: 'ADMIN' },
        'cred-1',
        { status: 'PENDING' },
      ),
    ).rejects.toThrow('STATUS_UNCHANGED');
  });

  it('rejects invalid status transitions', async () => {
    const service = new CredentialService();
    mockRepository.getCredentialScopeById.mockResolvedValue(buildScope({ status: 'ISSUED' }));

    await expect(
      service.updateCredentialStatus(
        { userId: 'admin-1', role: 'ADMIN' },
        'cred-1',
        { status: 'PENDING' },
      ),
    ).rejects.toThrow('INVALID_STATUS_TRANSITION');
  });

  it('rejects immutable expired credentials unless explicitly reissuing', async () => {
    const service = new CredentialService();
    mockRepository.getCredentialScopeById.mockResolvedValue(buildScope({ status: 'EXPIRED' }));

    await expect(
      service.updateCredentialStatus(
        { userId: 'admin-1', role: 'ADMIN' },
        'cred-1',
        { status: 'ISSUED' },
      ),
    ).rejects.toThrow('CREDENTIAL_EXPIRED_IMMUTABLE');
  });

  it('sets issuedDate and clears expiry for non-expiring issued credentials', async () => {
    const service = new CredentialService();
    mockRepository.getCredentialScopeById.mockResolvedValue(
      buildScope({ type: 'DEGREE', status: 'PENDING', fileHash: 'hash-1' }),
    );

    await service.updateCredentialStatus(
      { userId: 'admin-1', role: 'ADMIN' },
      'cred-1',
      { status: 'ISSUED' },
      { notifyIssued: true },
    );

    expect(mockRepository.updateCredential).toHaveBeenCalledWith(
      'cred-1',
      expect.objectContaining({
        status: 'ISSUED',
        issuedDate: expect.any(Date),
        expiryDate: null,
        chain: 'POLYGON',
      }),
    );
    expect(mockNotificationClient.sendCredentialIssuedNotification).toHaveBeenCalled();
    expect(mockRealtimeClient.publishMany).toHaveBeenCalled();
  });

  it('requires expiry dates for issued licenses', async () => {
    const service = new CredentialService();
    mockRepository.getCredentialScopeById.mockResolvedValue(
      buildScope({ type: 'LICENSE', status: 'PENDING', expiryDate: null }),
    );

    await expect(
      service.updateCredentialStatus(
        { userId: 'admin-1', role: 'ADMIN' },
        'cred-1',
        { status: 'ISSUED' },
      ),
    ).rejects.toThrow('EXPIRY_DATE_REQUIRED');
  });

  it('rejects invalid certificate categories', async () => {
    const service = new CredentialService();
    mockRepository.getCredentialScopeById.mockResolvedValue(
      buildScope({ type: 'CERTIFICATE', metadata: null }),
    );

    await expect(
      service.updateCredentialStatus(
        { userId: 'admin-1', role: 'ADMIN' },
        'cred-1',
        {
          status: 'ISSUED',
          metadata: { certificateCategory: 'BAD_VALUE' },
        },
      ),
    ).rejects.toThrow('INVALID_CERTIFICATE_CATEGORY');
  });

  it('rejects invalid block numbers', async () => {
    const service = new CredentialService();
    mockRepository.getCredentialScopeById.mockResolvedValue(buildScope());

    await expect(
      service.updateCredentialStatus(
        { userId: 'admin-1', role: 'ADMIN' },
        'cred-1',
        { status: 'ISSUED', blockNumber: 3.14 as never },
      ),
    ).rejects.toThrow('INVALID_BLOCK_NUMBER');
  });

  it('maps blockchain anchor failures to service-level errors', async () => {
    const service = new CredentialService();
    mockRepository.getCredentialScopeById.mockResolvedValue(buildScope({ status: 'PENDING', fileHash: 'hash-1' }));
    mockBlockchainClient.anchorCredential.mockRejectedValue(new Error('BLOCKCHAIN_INTERFACE_UNREACHABLE'));

    await expect(
      service.updateCredentialStatus(
        { userId: 'admin-1', role: 'ADMIN' },
        'cred-1',
        { status: 'ISSUED' },
      ),
    ).rejects.toThrow('BLOCKCHAIN_INTERFACE_UNREACHABLE');
  });

  it('revokes on-chain credentials and emits status-change side effects', async () => {
    const service = new CredentialService();
    mockRepository.getCredentialScopeById.mockResolvedValue(
      buildScope({
        status: 'ISSUED',
        type: 'LICENSE',
        chain: 'POLYGON',
        txHash: '0xabc',
        blockNumber: 12,
        anchoredAt: new Date('2026-03-02T00:00:00.000Z'),
        expiryDate: new Date('2026-04-01T00:00:00.000Z'),
      }),
    );
    mockRepository.updateCredential.mockResolvedValue(
      buildUpdatedCredential({
        status: 'REVOKED',
        type: 'LICENSE',
        title: 'Professional License',
      }),
    );

    await service.updateCredentialStatus(
      { userId: 'admin-1', role: 'ADMIN' },
      'cred-1',
      { status: 'REVOKED' },
    );

    expect(mockBlockchainClient.revokeCredential).toHaveBeenCalledWith({ credentialId: 'cred-1' });
    expect(mockNotificationClient.sendCredentialStatusChangedNotification).toHaveBeenCalled();
    expect(mockRealtimeClient.publishMany).toHaveBeenCalled();
  });
});
