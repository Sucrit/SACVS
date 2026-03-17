import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUserRepository,
  mockNotificationClient,
  mockRealtimeClient,
  mockEmailClient,
  mockClerkClient,
} = vi.hoisted(() => ({
  mockUserRepository: {
    listApprovedAdminNotificationRecipients: vi.fn(),
    getUserById: vi.fn(),
    upsertOrganizationOnboardingByClerkUserId: vi.fn(),
    upsertStudentProfileByUserId: vi.fn(),
    createInstitutionStudentAudit: vi.fn(),
    getUserContextById: vi.fn(),
    getUserDisplayNamesByIds: vi.fn(),
    createStepUpChallenge: vi.fn(),
    createAuditLog: vi.fn(),
    markStepUpChallengeAttempt: vi.fn(),
    verifyStepUpChallengeAndCreateSession: vi.fn(),
    listInstitutionStudents: vi.fn(),
    createInstitutionStudentByClerkUserId: vi.fn(),
    updateInstitutionStudentStatus: vi.fn(),
    updateInstitutionStudent: vi.fn(),
    getInstitutionStudentIdentity: vi.fn(),
    deleteInstitutionStudentAccount: vi.fn(),
    updateUserStatus: vi.fn(),
    updateUserRole: vi.fn(),
    listAuditLogsForRoleScope: vi.fn(),
    createUser: vi.fn(),
    listUsersForAdmin: vi.fn(),
  },
  mockNotificationClient: {
    createSystemNotification: vi.fn(),
  },
  mockRealtimeClient: {
    publishMany: vi.fn(),
  },
  mockEmailClient: {
    sendStepUpOtpEmail: vi.fn(),
  },
  mockClerkClient: {
    users: {
      getUser: vi.fn(),
      createUser: vi.fn(),
      deleteUser: vi.fn(),
    },
  },
}));

vi.mock('../../repository/user.repository', () => ({
  UserRepository: vi.fn(() => mockUserRepository),
}));

vi.mock('../../client/notification.client', () => ({
  notificationClient: mockNotificationClient,
}));

vi.mock('../../client/realtime.client', () => ({
  realtimeClient: mockRealtimeClient,
}));

vi.mock('../../client/email.client', () => ({
  emailClient: mockEmailClient,
}));

vi.mock('@clerk/express', () => ({
  clerkClient: mockClerkClient,
}));

import { UserService } from '../user.service';

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRepository.listApprovedAdminNotificationRecipients.mockResolvedValue([]);
    mockUserRepository.getUserById.mockResolvedValue(null);
    mockUserRepository.upsertOrganizationOnboardingByClerkUserId.mockResolvedValue({
      id: 'institution-user-1',
      email: 'owner@example.edu',
      firstName: 'Mobi',
      middleName: null,
      lastName: 'Smith',
      institutionId: 'inst-1',
      institution: { institutionName: 'Alias University' },
      profile: null,
      role: 'INSTITUTION',
      status: 'PENDING',
    });
    mockUserRepository.upsertStudentProfileByUserId.mockResolvedValue({
      id: 'student-1',
      profile: { studentNumber: '2020-10001' },
    });
    mockUserRepository.getUserDisplayNamesByIds.mockResolvedValue(new Map());
    mockClerkClient.users.getUser.mockResolvedValue({
      primaryEmailAddressId: 'primary-email',
      emailAddresses: [{ id: 'primary-email', emailAddress: 'owner@example.edu' }],
    });
  });

  it('routes organization-like profile payloads into onboarding and supports legacy aliases', async () => {
    const service = new UserService();

    const result = await service.submitOwnProfile({
      userId: 'institution-user-1',
      authRole: 'INSTITUTION',
      authenticatedEmail: 'owner@example.edu',
      payload: {
        role: 'INSTITUTION',
        firstName: ' Mobi ',
        lastName: ' Smith ',
        registrationNumber: ' REG-1 ',
        organizationEmail: ' INFO@ALIAS.EDU ',
        phoneNumber: '+639123456789',
        organizationName: ' Alias University ',
        accreditationNumber: ' ACC-9 ',
      },
    });

    expect(mockUserRepository.upsertOrganizationOnboardingByClerkUserId).toHaveBeenCalledWith(
      'institution-user-1',
      expect.objectContaining({
        userEmail: 'owner@example.edu',
        firstName: 'Mobi',
        lastName: 'Smith',
        organizationEmail: 'info@alias.edu',
        institution: {
          institutionName: 'Alias University',
          accreditationNumber: 'ACC-9',
        },
      }),
    );
    expect(mockUserRepository.upsertStudentProfileByUserId).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'institution-user-1',
      institution: { institutionName: 'Alias University' },
    });
  });

  it('rejects organization onboarding payloads with invalid phone numbers', async () => {
    const service = new UserService();

    await expect(
      service.completeOrganizationOnboardingFromPayload('institution-user-1', {
        role: 'INSTITUTION',
        firstName: 'Mobi',
        lastName: 'Smith',
        registrationNumber: 'REG-1',
        organizationEmail: 'info@alias.edu',
        phoneNumber: '09123456789',
        institutionName: 'Alias University',
        accreditationNumber: 'ACC-9',
      }),
    ).rejects.toThrow('INVALID_PHONE_NUMBER');
  });

  it('rejects non-students submitting student profile payloads', async () => {
    const service = new UserService();

    await expect(
      service.submitOwnProfile({
        userId: 'institution-user-1',
        authRole: 'INSTITUTION',
        payload: {
          studentNumber: '2020-10001',
          street: 'Street',
          barangay: 'Barangay',
          city: 'City',
          province: 'Province',
          zipCode: 1000,
          courseOfStudy: 'Computer Science',
          yearLevel: '4',
          department: 'CEA',
        },
      }),
    ).rejects.toThrow('STUDENT_PROFILE_FORBIDDEN');
  });

  it('normalizes valid student profile payloads before persisting', async () => {
    const service = new UserService();

    await service.submitOwnProfile({
      userId: 'student-1',
      authRole: 'STUDENT',
      payload: {
        studentNumber: ' 2020-10001 ',
        street: ' Main St ',
        barangay: ' Barangay 1 ',
        city: ' Manila ',
        province: ' Metro Manila ',
        zipCode: '1000',
        phone: ' +639123456789 ',
        courseOfStudy: ' Computer Science ',
        yearLevel: ' 4 ',
        department: ' CEA ',
        guardianFullName: ' Parent Name ',
        guardianRelationship: ' Mother ',
        birthday: '2000-01-01',
        sex: 'MALE',
      },
    });

    expect(mockUserRepository.upsertStudentProfileByUserId).toHaveBeenCalledWith(
      'student-1',
      expect.objectContaining({
        studentNumber: '2020-10001',
        street: 'Main St',
        barangay: 'Barangay 1',
        city: 'Manila',
        province: 'Metro Manila',
        zipCode: 1000,
        phone: '+639123456789',
        courseOfStudy: 'Computer Science',
        yearLevel: '4',
        department: 'CEA',
        guardianFullName: 'Parent Name',
        guardianRelationship: 'Mother',
        birthday: '2000-01-01',
        sex: 'MALE',
      }),
    );
    expect(mockRealtimeClient.publishMany).toHaveBeenCalled();
  });

  it('enforces immutable birthday once already set', async () => {
    const service = new UserService();
    mockUserRepository.getUserById.mockResolvedValue({
      id: 'student-1',
      profile: {
        birthday: new Date('2000-01-01T00:00:00.000Z'),
        sex: null,
      },
    });

    await expect(
      service.submitOwnProfile({
        userId: 'student-1',
        authRole: 'STUDENT',
        payload: {
          studentNumber: '2020-10001',
          street: 'Street',
          barangay: 'Barangay',
          city: 'City',
          province: 'Province',
          zipCode: 1000,
          courseOfStudy: 'Computer Science',
          yearLevel: '4',
          department: 'CEA',
          birthday: '2001-01-01',
        },
      }),
    ).rejects.toThrow('BIRTHDAY_IMMUTABLE');
  });

  it('enforces immutable sex once already set', async () => {
    const service = new UserService();
    mockUserRepository.getUserById.mockResolvedValue({
      id: 'student-1',
      profile: {
        birthday: null,
        sex: 'MALE',
      },
    });

    await expect(
      service.submitOwnProfile({
        userId: 'student-1',
        authRole: 'STUDENT',
        payload: {
          studentNumber: '2020-10001',
          street: 'Street',
          barangay: 'Barangay',
          city: 'City',
          province: 'Province',
          zipCode: 1000,
          courseOfStudy: 'Computer Science',
          yearLevel: '4',
          department: 'CEA',
          sex: 'FEMALE',
        },
      }),
    ).rejects.toThrow('SEX_IMMUTABLE');
  });

  it('rejects invalid guardian field shapes', async () => {
    const service = new UserService();

    await expect(
      service.submitOwnProfile({
        userId: 'student-1',
        authRole: 'STUDENT',
        payload: {
          studentNumber: '2020-10001',
          street: 'Street',
          barangay: 'Barangay',
          city: 'City',
          province: 'Province',
          zipCode: 1000,
          courseOfStudy: 'Computer Science',
          yearLevel: '4',
          department: 'CEA',
          guardianFullName: 12345,
        },
      }),
    ).rejects.toThrow('INVALID_GUARDIAN_FULL_NAME');
  });
});
