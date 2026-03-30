import crypto from 'node:crypto';
import { clerkClient } from '@clerk/express';
import { StepUpAction } from '../../../../db/node_modules/@prisma/client';
import {
  BulkCreateInstitutionStudentsResultDto,
  CreateStepUpChallengeDto,
  CreateInstitutionStudentDto,
  CompleteOrganizationOnboardingDto,
  CreateUserDto,
  StudentSex,
  VerifyStepUpChallengeDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UpsertStudentProfileDto,
  UserStatus,
} from '../dto/user.dto';
import { UserRepository } from '../repository/user.repository';
import { ENV } from '../config/env';
import { emailClient } from '../client/email.client';
import { notificationClient } from '../client/notification.client';
import { realtimeClient } from '../client/realtime.client';

const userRepository = new UserRepository();
const PH_PHONE_REGEX = /^\+63\d{10}$/;
const VALID_STUDENT_SEXES = new Set<StudentSex>(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']);
const REQUIRED_STUDENT_PROFILE_FIELDS: Array<keyof UpsertStudentProfileDto> = [
  'studentNumber',
  'street',
  'barangay',
  'city',
  'province',
  'courseOfStudy',
  'yearLevel',
  'department',
];

const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, errorCode: string): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(errorCode)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};
const stepUpActionLabel = (action: StepUpAction): string => {
  if (action === 'ROLE_CHANGE') return 'Role change';
  if (action === 'STATUS_CHANGE') return 'Status change';
  if (action === 'CREDENTIAL_ISSUE') return 'Credential issuance';
  if (action === 'BULK_STUDENT_CREATE') return 'Bulk student creation';
  return 'QR document download enable';
};
const normalizeErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const maybeErrors = (error as { errors?: Array<{ message?: string }> }).errors;
    const first = maybeErrors?.[0]?.message;
    if (typeof first === 'string' && first.trim().length > 0) {
      return first;
    }
  }

  return 'Unknown error';
};

type WithApprover = { approvedById: string | null };

export class UserService {
  private isValidPhilippinePhoneNumber(value: string): boolean {
    return PH_PHONE_REGEX.test(value.trim());
  }

  private formatFullName(user: {
    firstName: string;
    middleName?: string | null;
    lastName: string;
  }): string {
    return [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
  }

  private async notifyApprovedAdminsAboutInstitutionAccountRequest(payload: {
    institutionUserId: string;
    institutionId: string | null;
    institutionName: string | null;
    applicantEmail: string;
    applicantName: string;
    organizationEmail: string;
    registrationNumber: string;
  }): Promise<void> {
    try {
      const recipients = await userRepository.listApprovedAdminNotificationRecipients();
      if (recipients.length === 0) {
        return;
      }

      const institutionLabel = payload.institutionName || 'Institution account';
      const title = 'New institution account request';
      const message = `${payload.applicantName} submitted a new institution account request for ${institutionLabel}.`;

      await Promise.allSettled(
        recipients.map(recipient =>
          notificationClient.createSystemNotification({
            userId: recipient.id,
            type: 'SYSTEM_ANNOUNCEMENT',
            title,
            message,
            metadata: {
              event: 'INSTITUTION_ACCOUNT_REQUEST_CREATED',
              userId: payload.institutionUserId,
              institutionId: payload.institutionId,
              institutionName: payload.institutionName,
              applicantName: payload.applicantName,
              applicantEmail: payload.applicantEmail,
              organizationEmail: payload.organizationEmail,
              registrationNumber: payload.registrationNumber,
              targetId: payload.institutionUserId,
              targetType: 'User',
            },
          }),
        ),
      );
    } catch (error) {
      console.error('Failed to notify admins about institution account request:', error);
    }
  }

  private getStepUpPepperOrThrow(): string {
    const pepper = ENV.STEP_UP_TOKEN_PEPPER?.trim();
    if (!pepper) {
      throw new Error('STEP_UP_TOKEN_INVALID');
    }
    return pepper;
  }

  private hashStepUpValue(raw: string): string {
    const pepper = this.getStepUpPepperOrThrow();
    return crypto.createHash('sha256').update(`${raw}:${pepper}`).digest('hex');
  }

  private generateOtpCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private normalizeOptionalString(value: string | undefined | null): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private inferOrganizationRoleFromPayload(payload: unknown): 'INSTITUTION' | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const data = payload as Record<string, unknown>;
    const role = typeof data.role === 'string' ? data.role : null;
    if (role === 'INSTITUTION') {
      return role;
    }

    const hasInstitutionHints =
      typeof data.institutionName === 'string' ||
      typeof data.name === 'string' ||
      typeof data.accreditationNumber === 'string';

    return hasInstitutionHints ? 'INSTITUTION' : null;
  }

  private isLikelyOrganizationOnboardingPayload(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const data = payload as Record<string, unknown>;
    const hasOrgCommonHints =
      typeof data.firstName === 'string' ||
      typeof data.lastName === 'string' ||
      typeof data.registrationNumber === 'string' ||
      typeof data.organizationEmail === 'string' ||
      typeof data.phoneNumber === 'string' ||
      typeof data.organizationName === 'string' ||
      typeof data.institutionName === 'string' ||
      typeof data.name === 'string' ||
      typeof data.accreditationNumber === 'string';

    const hasStudentHints =
      typeof data.studentNumber === 'string' ||
      typeof data.street === 'string' ||
      typeof data.barangay === 'string' ||
      typeof data.city === 'string' ||
      typeof data.province === 'string' ||
      typeof data.courseOfStudy === 'string' ||
      typeof data.yearLevel === 'string' ||
      typeof data.department === 'string';

    return hasOrgCommonHints && !hasStudentHints;
  }

  private normalizeOrganizationOnboardingPayload(payload: unknown): CompleteOrganizationOnboardingDto {
    if (!payload || typeof payload !== 'object') {
      throw new Error('INVALID_REQUEST_PAYLOAD');
    }

    const body = { ...(payload as Record<string, unknown>) };
    if (typeof body.organizationName === 'string' && body.role === 'INSTITUTION' && typeof body.institutionName !== 'string') {
      body.institutionName = body.organizationName;
    }
    if (body.role === 'INSTITUTION' && typeof body.institutionName !== 'string' && typeof body.name === 'string') {
      body.institutionName = body.name;
    }

    const data = body as Partial<CompleteOrganizationOnboardingDto>;
    if (data.role !== 'INSTITUTION') {
      throw new Error('MISSING_REQUIRED_FIELD:role');
    }
    if (typeof data.firstName !== 'string' || data.firstName.trim().length === 0) {
      throw new Error('MISSING_REQUIRED_FIELD:firstName');
    }
    if (typeof data.lastName !== 'string' || data.lastName.trim().length === 0) {
      throw new Error('MISSING_REQUIRED_FIELD:lastName');
    }

    const requiredCommonFields: Array<keyof CompleteOrganizationOnboardingDto> = [
      'registrationNumber',
      'organizationEmail',
      'phoneNumber',
    ];
    const missingCommonField = requiredCommonFields.find((field) => {
      const value = data[field];
      return typeof value !== 'string' || value.trim().length === 0;
    });
    if (missingCommonField) {
      throw new Error(`MISSING_REQUIRED_FIELD:${missingCommonField}`);
    }

    if (!this.isValidPhilippinePhoneNumber(data.phoneNumber!)) {
      throw new Error('INVALID_PHONE_NUMBER');
    }
    if (typeof data.institutionName !== 'string' || data.institutionName.trim().length === 0) {
      throw new Error('MISSING_REQUIRED_FIELD:institutionName');
    }
    if (typeof data.accreditationNumber !== 'string' || data.accreditationNumber.trim().length === 0) {
      throw new Error('MISSING_REQUIRED_FIELD:accreditationNumber');
    }

    return {
      role: 'INSTITUTION',
      firstName: data.firstName.trim(),
      middleName: this.normalizeOptionalString(data.middleName),
      lastName: data.lastName.trim(),
      registrationNumber: data.registrationNumber!.trim(),
      organizationEmail: data.organizationEmail!.trim(),
      phoneNumber: data.phoneNumber!.trim(),
      institutionName: data.institutionName.trim(),
      accreditationNumber: data.accreditationNumber.trim(),
    };
  }

  private normalizeStudentProfilePayload(payload: unknown): UpsertStudentProfileDto {
    if (!payload || typeof payload !== 'object') {
      throw new Error('INVALID_REQUEST_PAYLOAD');
    }

    const profileData = payload as Partial<UpsertStudentProfileDto>;
    const missingField = REQUIRED_STUDENT_PROFILE_FIELDS.find((field) => {
      const value = profileData[field];
      return typeof value !== 'string' || value.trim().length === 0;
    });
    if (missingField) {
      throw new Error(`MISSING_REQUIRED_FIELD:${missingField}`);
    }

    const parsedZipCode = Number(profileData.zipCode);
    if (!Number.isInteger(parsedZipCode) || parsedZipCode <= 0) {
      throw new Error('MISSING_REQUIRED_FIELD:zipCode');
    }

    let normalizedBirthday: string | null | undefined = undefined;
    if (typeof profileData.birthday !== 'undefined') {
      if (profileData.birthday === null) {
        normalizedBirthday = null;
      } else if (typeof profileData.birthday === 'string') {
        const trimmed = profileData.birthday.trim();
        if (!trimmed) {
          normalizedBirthday = null;
        } else {
          const parsed = new Date(trimmed);
          if (Number.isNaN(parsed.getTime())) {
            throw new Error('INVALID_BIRTHDAY');
          }
          normalizedBirthday = trimmed;
        }
      } else {
        throw new Error('INVALID_BIRTHDAY');
      }
    }

    if (typeof profileData.sex !== 'undefined' && profileData.sex !== null && !VALID_STUDENT_SEXES.has(profileData.sex)) {
      throw new Error('INVALID_SEX');
    }
    if (
      typeof profileData.guardianFullName !== 'undefined' &&
      profileData.guardianFullName !== null &&
      typeof profileData.guardianFullName !== 'string'
    ) {
      throw new Error('INVALID_GUARDIAN_FULL_NAME');
    }
    if (
      typeof profileData.guardianRelationship !== 'undefined' &&
      profileData.guardianRelationship !== null &&
      typeof profileData.guardianRelationship !== 'string'
    ) {
      throw new Error('INVALID_GUARDIAN_RELATIONSHIP');
    }
    if (
      typeof profileData.phone !== 'undefined' &&
      profileData.phone !== null &&
      typeof profileData.phone !== 'string'
    ) {
      throw new Error('INVALID_PHONE');
    }
    if (
      typeof profileData.phone === 'string' &&
      profileData.phone.trim().length > 0 &&
      !this.isValidPhilippinePhoneNumber(profileData.phone)
    ) {
      throw new Error('INVALID_PHONE_FORMAT');
    }

    return {
      studentNumber: profileData.studentNumber!.trim(),
      street: profileData.street!.trim(),
      barangay: profileData.barangay!.trim(),
      city: profileData.city!.trim(),
      province: profileData.province!.trim(),
      zipCode: parsedZipCode,
      phone: typeof profileData.phone === 'string' ? profileData.phone.trim() : profileData.phone,
      courseOfStudy: profileData.courseOfStudy!.trim(),
      yearLevel: profileData.yearLevel!.trim(),
      department: profileData.department!.trim(),
      birthday: normalizedBirthday,
      sex: profileData.sex,
      guardianFullName:
        typeof profileData.guardianFullName === 'string'
          ? profileData.guardianFullName.trim()
          : profileData.guardianFullName,
      guardianRelationship:
        typeof profileData.guardianRelationship === 'string'
          ? profileData.guardianRelationship.trim()
          : profileData.guardianRelationship,
    };
  }

  private async assertImmutableStudentProfileFields(
    userId: string,
    profileData: UpsertStudentProfileDto,
  ): Promise<void> {
    const currentUser = await this.getCurrentUser(userId);
    const currentProfile = currentUser?.profile;

    if (currentProfile?.birthday) {
      const existingBirthdayDate = new Date(currentProfile.birthday).toISOString().slice(0, 10);
      const incomingBirthdayDate =
        typeof profileData.birthday === 'undefined'
          ? undefined
          : profileData.birthday === null
            ? null
            : new Date(profileData.birthday).toISOString().slice(0, 10);

      if (incomingBirthdayDate !== undefined && incomingBirthdayDate !== existingBirthdayDate) {
        throw new Error('BIRTHDAY_IMMUTABLE');
      }
    }

    if (
      currentProfile?.sex &&
      typeof profileData.sex !== 'undefined' &&
      profileData.sex !== currentProfile.sex
    ) {
      throw new Error('SEX_IMMUTABLE');
    }
  }

  private async addApproverNames<T extends WithApprover>(
    records: T[],
  ): Promise<Array<T & { approverName: string | null }>> {
    const approverIds = Array.from(
      new Set(records.map(record => record.approvedById).filter((value): value is string => Boolean(value))),
    );
    const namesById = await userRepository.getUserDisplayNamesByIds(approverIds);

    return records.map(record => ({
      ...record,
      approverName: record.approvedById ? namesById.get(record.approvedById) ?? null : null,
    }));
  }

  private async addApproverName<T extends WithApprover>(
    record: T,
  ): Promise<T & { approverName: string | null }> {
    const [enriched] = await this.addApproverNames([record]);
    return enriched;
  }

  private publishInstitutionEvent(
    institutionId: string,
    action:
      | 'institution.student.created'
      | 'institution.student.bulk_imported'
      | 'institution.student.status.updated'
      | 'institution.student.updated'
      | 'institution.student.deleted',
    entityId?: string,
    payload?: Record<string, unknown>,
  ): void {
    void realtimeClient.publishMany([
      {
        domain: 'users',
        action,
        entityId,
        scope: { institutionIds: [institutionId], roles: ['ADMIN', 'INSTITUTION'] },
        payload,
      },
      {
        domain: 'audit',
        action: 'log.created',
        scope: { roles: ['ADMIN', 'INSTITUTION'] },
      },
    ]);
  }

  private publishAdminUserEvent(
    action: 'admin.user.status.updated' | 'admin.user.role.updated',
    entityId: string,
  ): void {
    void realtimeClient.publishMany([
      {
        domain: 'users',
        action,
        entityId,
        scope: { roles: ['ADMIN'] },
      },
      {
        domain: 'audit',
        action: 'log.created',
        scope: { roles: ['ADMIN'] },
      },
    ]);
  }

  private publishProfileUpdatedEvent(userId: string): void {
    void realtimeClient.publishMany([
      {
        domain: 'users',
        action: 'profile.updated',
        entityId: userId,
        scope: { userIds: [userId], roles: ['ADMIN', 'INSTITUTION'] },
      },
      {
        domain: 'audit',
        action: 'log.created',
        scope: { roles: ['ADMIN', 'INSTITUTION'] },
      },
    ]);
  }

  private isClerkUserNotFoundError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('not found') || message.includes('resource_not_found')) {
        return true;
      }
    }

    if (typeof error === 'object' && error !== null) {
      const maybeErrors = (error as { errors?: Array<{ code?: string; message?: string }> }).errors;
      if (Array.isArray(maybeErrors)) {
        return maybeErrors.some(item => {
          const code = (item.code ?? '').toLowerCase();
          const message = (item.message ?? '').toLowerCase();
          return code.includes('not_found') || message.includes('not found');
        });
      }
    }

    return false;
  }

  private async getInstitutionActorContext(actorUserId: string): Promise<{
    id: string;
    institutionId: string;
  }> {
    const actor = await userRepository.getUserContextById(actorUserId);
    if (!actor) {
      throw new Error('ACTOR_NOT_FOUND');
    }
    if (actor.role !== 'INSTITUTION') {
      throw new Error('FORBIDDEN_ROLE');
    }
    if (!actor.institutionId) {
      throw new Error('INSTITUTION_CONTEXT_MISSING');
    }

    return {
      id: actor.id,
      institutionId: actor.institutionId,
    };
  }

  private async getInstitutionOwnerContext(actorUserId: string): Promise<{
    id: string;
    institutionId: string;
  }> {
    return this.getInstitutionActorContext(actorUserId);
  }

  private async createInstitutionStudentForContext(
    institutionId: string,
    actorUserId: string,
    data: CreateInstitutionStudentDto,
  ) {
    const normalizedEmail = normalizeEmail(data.email);
    let createdClerkUserId: string | null = null;

    try {
      const clerkUser = await clerkClient.users.createUser({
        emailAddress: [normalizedEmail],
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        skipPasswordRequirement: true,
        skipPasswordChecks: true,
        publicMetadata: {
          role: 'STUDENT',
          institutionId,
        },
      });
      createdClerkUserId = clerkUser.id;

      return await userRepository.createInstitutionStudentByClerkUserId(
        clerkUser.id,
        institutionId,
        {
          ...data,
          email: normalizedEmail,
        },
        actorUserId,
      );
    } catch (error) {
      if (createdClerkUserId) {
        try {
          await clerkClient.users.deleteUser(createdClerkUserId);
        } catch (cleanupError) {
          console.error('Failed to rollback Clerk user after DB failure:', cleanupError);
        }
      }
      throw error;
    }
  }

  async listUsers() {
    return userRepository.listUsersForAdmin();
  }

  async createStepUpChallenge(
    userId: string,
    data: CreateStepUpChallengeDto,
    context?: { correlationId?: string | null; ipAddress?: string | null; userAgent?: string | null },
  ): Promise<{
    challengeId: string;
    expiresAt: string;
    delivery: 'EMAIL_OTP';
  }> {
    const actor = await userRepository.getUserById(userId);
    if (!actor) {
      throw new Error('ACTOR_NOT_FOUND');
    }

    const action = data.action as StepUpAction;
    const otpCode = this.generateOtpCode();
    const codeHash = this.hashStepUpValue(otpCode);
    const ttlSeconds = Math.max(60, Math.min(600, Math.floor(ENV.STEP_UP_OTP_TTL_SECONDS)));
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const maxAttempts = Math.max(3, Math.min(10, Math.floor(ENV.STEP_UP_MAX_ATTEMPTS)));
    const created = await userRepository.createStepUpChallenge({
      userId,
      action,
      targetId: this.normalizeOptionalString(data.targetId),
      payloadHash: this.normalizeOptionalString(data.payloadHash),
      codeHash,
      expiresAt,
      maxAttempts,
    });

    try {
      await emailClient.sendStepUpOtpEmail({
        to: actor.email,
        otpCode,
        expiresInMinutes: Math.max(1, Math.floor(ttlSeconds / 60)),
        actionLabel: stepUpActionLabel(action),
      });
    } catch (error) {
      console.error('Failed to dispatch step-up OTP email:', error);
      throw error instanceof Error && error.message === 'STEP_UP_DELIVERY_NOT_CONFIGURED'
        ? new Error('STEP_UP_DELIVERY_NOT_CONFIGURED')
        : new Error('STEP_UP_DELIVERY_FAILED');
    }

    await userRepository.createAuditLog({
      action: 'SECURITY_ALERT',
      actorId: userId,
      targetType: 'StepUpChallenge',
      targetId: created.id,
      description: `Step-up challenge created for action ${action}`,
      metadata: {
        action,
        targetId: data.targetId ?? null,
        expiresAt: created.expiresAt.toISOString(),
        correlationId: context?.correlationId ?? null,
        ipAddress: context?.ipAddress ?? null,
        userAgent: context?.userAgent ?? null,
      },
      severity: 'INFO',
    });

    return {
      challengeId: created.id,
      expiresAt: created.expiresAt.toISOString(),
      delivery: 'EMAIL_OTP',
    };
  }

  async verifyStepUpChallenge(
    userId: string,
    challengeId: string,
    data: VerifyStepUpChallengeDto,
    context?: { correlationId?: string | null; ipAddress?: string | null; userAgent?: string | null },
  ): Promise<{ stepUpToken: string; expiresAt: string }> {
    const challenge = await userRepository.getStepUpChallengeById(challengeId, userId);
    if (!challenge) throw new Error('STEP_UP_TOKEN_INVALID');
    if (challenge.lockedAt) throw new Error('STEP_UP_CHALLENGE_LOCKED');
    if (challenge.verifiedAt) throw new Error('STEP_UP_TOKEN_INVALID');
    if (challenge.expiresAt <= new Date()) throw new Error('STEP_UP_TOKEN_EXPIRED');

    const submittedHash = this.hashStepUpValue(data.otpCode.trim());
    const valid = crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(challenge.codeHash));
    if (!valid) {
      const nextAttempts = challenge.attempts + 1;
      await userRepository.markStepUpChallengeAttempt(
        challenge.id,
        nextAttempts,
        nextAttempts >= challenge.maxAttempts,
      );
      await userRepository.createAuditLog({
        action: 'ACCESS_DENIED',
        actorId: userId,
        targetType: 'StepUpChallenge',
        targetId: challenge.id,
        description: 'Invalid step-up OTP attempt',
        metadata: {
          attempts: nextAttempts,
          maxAttempts: challenge.maxAttempts,
          action: challenge.action,
          correlationId: context?.correlationId ?? null,
          ipAddress: context?.ipAddress ?? null,
          userAgent: context?.userAgent ?? null,
        },
        severity: 'WARNING',
      });
      if (nextAttempts >= challenge.maxAttempts) {
        throw new Error('STEP_UP_CHALLENGE_LOCKED');
      }
      throw new Error('STEP_UP_TOKEN_INVALID');
    }

    const rawSessionToken = crypto.randomBytes(32).toString('base64url');
    const sessionTokenHash = this.hashStepUpValue(rawSessionToken);
    const isIssuanceAction = challenge.action === 'CREDENTIAL_ISSUE';
    const sessionTtlSeconds = isIssuanceAction
      ? Math.max(60, Math.min(1800, Math.floor(ENV.STEP_UP_ISSUANCE_SESSION_TTL_SECONDS)))
      : Math.max(60, Math.min(600, Math.floor(ENV.STEP_UP_SESSION_TTL_SECONDS)));
    const sessionExpiresAt = new Date(Date.now() + sessionTtlSeconds * 1000);
    const session = await userRepository.verifyStepUpChallengeAndCreateSession({
      challengeId: challenge.id,
      userId,
      tokenHash: sessionTokenHash,
      expiresAt: sessionExpiresAt,
      reusable: isIssuanceAction,
    });

    await userRepository.createAuditLog({
      action: 'ACCESS_GRANTED',
      actorId: userId,
      targetType: 'StepUpChallenge',
      targetId: challenge.id,
      description: `Step-up challenge verified for action ${challenge.action}`,
      metadata: {
        action: challenge.action,
        sessionId: session.sessionId,
        expiresAt: session.expiresAt.toISOString(),
        correlationId: context?.correlationId ?? null,
        ipAddress: context?.ipAddress ?? null,
        userAgent: context?.userAgent ?? null,
      },
      severity: 'INFO',
    });

    return {
      stepUpToken: rawSessionToken,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async listInstitutionStudents(actorUserId: string) {
    const actor = await this.getInstitutionActorContext(actorUserId);
    const students = await userRepository.listInstitutionStudents(actor.institutionId);
    return this.addApproverNames(students);
  }

  async createUser(data: CreateUserDto) {
    return userRepository.createUser(data);
  }

  async createInstitutionStudent(actorUserId: string, data: CreateInstitutionStudentDto) {
    const actor = await this.getInstitutionActorContext(actorUserId);
    const student = await this.createInstitutionStudentForContext(actor.institutionId, actor.id, data);
    try {
      await userRepository.createInstitutionStudentAudit(actor.id, student.id, student.email);
    } catch (error) {
      console.error('Failed to write institution student creation audit entry:', error);
    }
    const enriched = await this.addApproverName(student);
    this.publishInstitutionEvent(actor.institutionId, 'institution.student.created', student.id);
    return enriched;
  }

  async createInstitutionStudentsBulk(
    actorUserId: string,
    students: CreateInstitutionStudentDto[],
  ): Promise<BulkCreateInstitutionStudentsResultDto> {
    const actor = await this.getInstitutionActorContext(actorUserId);
    const failed: BulkCreateInstitutionStudentsResultDto['failed'] = [];
    let created = 0;

    for (let index = 0; index < students.length; index += 1) {
      const student = students[index];
      try {
        const createdStudent = await this.createInstitutionStudentForContext(
          actor.institutionId,
          actor.id,
          student,
        );
        try {
          await userRepository.createInstitutionStudentAudit(actor.id, createdStudent.id, createdStudent.email);
        } catch (error) {
          console.error('Failed to write bulk student creation audit entry:', error);
        }
        created += 1;
      } catch (error) {
        failed.push({
          index,
          email: student.email,
          error: normalizeErrorMessage(error),
        });
      }
    }

    this.publishInstitutionEvent(actor.institutionId, 'institution.student.bulk_imported', undefined, {
      created,
      failed: failed.length,
    });
    return { created, failed };
  }

  async getUserById(userId: string) {
    return userRepository.getUserByIdForAdmin(userId);
  }

  async getCurrentUser(userId: string) {
    return userRepository.getUserById(userId);
  }

  async upsertStudentProfileByUserId(userId: string, data: UpsertStudentProfileDto) {
    const updated = await userRepository.upsertStudentProfileByUserId(userId, data);
    this.publishProfileUpdatedEvent(userId);
    return updated;
  }

  async completeOrganizationOnboardingFromPayload(
    clerkUserId: string,
    payload: unknown,
    authenticatedEmail?: string | null,
  ) {
    const data = this.normalizeOrganizationOnboardingPayload(payload);
    return this.completeOrganizationOnboarding(clerkUserId, data, authenticatedEmail);
  }

  async submitOwnProfile(input: {
    userId: string;
    authRole?: string | null;
    authenticatedEmail?: string | null;
    payload: unknown;
  }) {
    const inferredRole = this.inferOrganizationRoleFromPayload(input.payload);
    if (inferredRole || this.isLikelyOrganizationOnboardingPayload(input.payload)) {
      return this.completeOrganizationOnboardingFromPayload(
        input.userId,
        input.payload,
        input.authenticatedEmail,
      );
    }

    if (input.authRole !== 'STUDENT') {
      throw new Error('STUDENT_PROFILE_FORBIDDEN');
    }

    const normalized = this.normalizeStudentProfilePayload(input.payload);
    await this.assertImmutableStudentProfileFields(input.userId, normalized);
    return this.upsertStudentProfileByUserId(input.userId, normalized);
  }

  async completeOrganizationOnboarding(
    clerkUserId: string,
    data: CompleteOrganizationOnboardingDto,
    _authenticatedEmail?: string | null,
  ) {
    const previousUser = await userRepository.getUserById(clerkUserId);

    let clerkUser;
    try {
      clerkUser = await withTimeout(clerkClient.users.getUser(clerkUserId), 8000, 'CLERK_TIMEOUT');
    } catch (error) {
      if (error instanceof Error && error.message === 'CLERK_TIMEOUT') {
        throw error;
      }
      throw new Error('CLERK_UNAVAILABLE');
    }

    const primaryEmail = clerkUser.emailAddresses.find(
      entry => entry.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress;
    const fallbackEmail = clerkUser.emailAddresses[0]?.emailAddress;
    const resolvedEmail = normalizeEmail(primaryEmail ?? fallbackEmail ?? '');

    if (!resolvedEmail) {
      throw new Error('CLERK_EMAIL_NOT_AVAILABLE');
    }

    const updatedUser = await userRepository.upsertOrganizationOnboardingByClerkUserId(clerkUserId, {
      userEmail: resolvedEmail,
      firstName: data.firstName.trim(),
      middleName: data.middleName?.trim() || null,
      lastName: data.lastName.trim(),
      role: data.role,
      registrationNumber: data.registrationNumber.trim(),
      organizationEmail: normalizeEmail(data.organizationEmail),
      phoneNumber: data.phoneNumber.trim(),
      institution: {
        institutionName: data.institutionName.trim(),
        accreditationNumber: data.accreditationNumber.trim(),
      },
    });

    const shouldNotifyAdmins =
      !previousUser ||
      previousUser.role !== 'INSTITUTION' ||
      previousUser.status !== 'PENDING';

    if (shouldNotifyAdmins) {
      void this.notifyApprovedAdminsAboutInstitutionAccountRequest({
        institutionUserId: updatedUser.id,
        institutionId: updatedUser.institutionId,
        institutionName: updatedUser.institution?.institutionName ?? data.institutionName.trim(),
        applicantEmail: updatedUser.email,
        applicantName: this.formatFullName(updatedUser),
        organizationEmail: normalizeEmail(data.organizationEmail),
        registrationNumber: data.registrationNumber.trim(),
      });
    }

    return updatedUser;
  }

  async updateInstitutionStudentStatus(
    actorUserId: string,
    studentUserId: string,
    status: UserStatus,
  ) {
    const actor = await this.getInstitutionActorContext(actorUserId);
    const updated = await userRepository.updateInstitutionStudentStatus(
      actor.institutionId,
      studentUserId,
      status,
      actorUserId,
    );

    if (!updated) {
      throw new Error('STUDENT_NOT_FOUND_OR_FORBIDDEN');
    }

    const enriched = await this.addApproverName(updated);
    this.publishInstitutionEvent(actor.institutionId, 'institution.student.status.updated', studentUserId);
    return enriched;
  }

  async updateInstitutionStudent(
    actorUserId: string,
    studentUserId: string,
    data: CreateInstitutionStudentDto,
  ) {
    const actor = await this.getInstitutionActorContext(actorUserId);
    const updated = await userRepository.updateInstitutionStudent(
      actor.institutionId,
      studentUserId,
      data,
      actorUserId,
    );

    if (!updated) {
      throw new Error('STUDENT_NOT_FOUND_OR_FORBIDDEN');
    }

    const enriched = await this.addApproverName(updated);
    this.publishInstitutionEvent(actor.institutionId, 'institution.student.updated', studentUserId);
    return enriched;
  }

  async deleteInstitutionStudent(actorUserId: string, studentUserId: string) {
    const actor = await this.getInstitutionActorContext(actorUserId);
    const target = await userRepository.getInstitutionStudentIdentity(actor.institutionId, studentUserId);
    if (!target) {
      throw new Error('STUDENT_NOT_FOUND_OR_FORBIDDEN');
    }

    try {
      await clerkClient.users.deleteUser(studentUserId);
    } catch (error) {
      if (!this.isClerkUserNotFoundError(error)) {
        throw new Error('CLERK_DELETE_FAILED');
      }
    }

    const deleted = await userRepository.deleteInstitutionStudentAccount(
      actor.institutionId,
      studentUserId,
      actor.id,
    );
    if (!deleted) {
      throw new Error('STUDENT_NOT_FOUND_OR_FORBIDDEN');
    }

    this.publishInstitutionEvent(actor.institutionId, 'institution.student.deleted', studentUserId);
    return deleted;
  }

  async updateUserStatus(userId: string, data: UpdateUserStatusDto, actorId?: string | null) {
    const updated = await userRepository.updateUserStatus(userId, data.status, actorId);
    this.publishAdminUserEvent('admin.user.status.updated', userId);
    return updated;
  }

  async updateUserRole(userId: string, data: UpdateUserRoleDto, actorId?: string | null) {
    const updated = await userRepository.updateUserRole(userId, data.role, actorId);
    this.publishAdminUserEvent('admin.user.role.updated', userId);
    return updated;
  }

  async listAuditLogs(actorUserId: string) {
    const actor = await userRepository.getUserContextById(actorUserId);
    if (!actor) {
      throw new Error('ACTOR_NOT_FOUND');
    }

    if (actor.role === 'STUDENT') {
      throw new Error('FORBIDDEN_ROLE');
    }

    return userRepository.listAuditLogsForRoleScope(actor);
  }
}
