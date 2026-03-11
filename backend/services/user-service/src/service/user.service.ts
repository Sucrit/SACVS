import crypto from 'node:crypto';
import { clerkClient } from '@clerk/express';
import { StepUpAction } from '../../../../db/node_modules/@prisma/client';
import {
  BulkCreateInstitutionStudentsResultDto,
  CreateStepUpChallengeDto,
  CreateInstitutionStudentDto,
  CompleteOrganizationOnboardingDto,
  CreateUserDto,
  VerifyStepUpChallengeDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UpsertStudentProfileDto,
  UserStatus,
} from '../dto/user.dto';
import { UserRepository } from '../repository/user.repository';
import { ENV } from '../config/env';
import { emailClient } from '../client/email.client';
import { realtimeClient } from '../client/realtime.client';

const userRepository = new UserRepository();

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

  async getAdminOverviewSummary() {
    return userRepository.getAdminOverviewSummary();
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
    const sessionTtlSeconds = Math.max(60, Math.min(600, Math.floor(ENV.STEP_UP_SESSION_TTL_SECONDS)));
    const sessionExpiresAt = new Date(Date.now() + sessionTtlSeconds * 1000);
    const session = await userRepository.verifyStepUpChallengeAndCreateSession({
      challengeId: challenge.id,
      userId,
      tokenHash: sessionTokenHash,
      expiresAt: sessionExpiresAt,
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
    void realtimeClient.publishMany([
      {
        domain: 'users',
        action: 'institution.student.created',
        entityId: student.id,
        scope: { institutionIds: [actor.institutionId], roles: ['ADMIN', 'INSTITUTION'] },
      },
      {
        domain: 'audit',
        action: 'log.created',
        scope: { roles: ['ADMIN', 'INSTITUTION'] },
      },
    ]);
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

    void realtimeClient.publishMany([
      {
        domain: 'users',
        action: 'institution.student.bulk_imported',
        scope: { institutionIds: [actor.institutionId], roles: ['ADMIN', 'INSTITUTION'] },
        payload: { created, failed: failed.length },
      },
      {
        domain: 'audit',
        action: 'log.created',
        scope: { roles: ['ADMIN', 'INSTITUTION'] },
      },
    ]);
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
    return updated;
  }

  async completeOrganizationOnboarding(
    clerkUserId: string,
    data: CompleteOrganizationOnboardingDto,
    _authenticatedEmail?: string | null,
  ) {
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

    return userRepository.upsertOrganizationOnboardingByClerkUserId(clerkUserId, {
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
    void realtimeClient.publishMany([
      {
        domain: 'users',
        action: 'institution.student.status.updated',
        entityId: studentUserId,
        scope: { institutionIds: [actor.institutionId], roles: ['ADMIN', 'INSTITUTION'] },
      },
      {
        domain: 'audit',
        action: 'log.created',
        scope: { roles: ['ADMIN', 'INSTITUTION'] },
      },
    ]);
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
    void realtimeClient.publishMany([
      {
        domain: 'users',
        action: 'institution.student.updated',
        entityId: studentUserId,
        scope: { institutionIds: [actor.institutionId], roles: ['ADMIN', 'INSTITUTION'] },
      },
      {
        domain: 'audit',
        action: 'log.created',
        scope: { roles: ['ADMIN', 'INSTITUTION'] },
      },
    ]);
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

    void realtimeClient.publishMany([
      {
        domain: 'users',
        action: 'institution.student.deleted',
        entityId: studentUserId,
        scope: { institutionIds: [actor.institutionId], roles: ['ADMIN', 'INSTITUTION'] },
      },
      {
        domain: 'audit',
        action: 'log.created',
        scope: { roles: ['ADMIN', 'INSTITUTION'] },
      },
    ]);
    return deleted;
  }

  async updateUserStatus(userId: string, data: UpdateUserStatusDto, actorId?: string | null) {
    const updated = await userRepository.updateUserStatus(userId, data.status, actorId);
    void realtimeClient.publishMany([
      {
        domain: 'users',
        action: 'admin.user.status.updated',
        entityId: userId,
        scope: { roles: ['ADMIN'] },
      },
      {
        domain: 'audit',
        action: 'log.created',
        scope: { roles: ['ADMIN'] },
      },
    ]);
    return updated;
  }

  async updateUserRole(userId: string, data: UpdateUserRoleDto, actorId?: string | null) {
    const updated = await userRepository.updateUserRole(userId, data.role, actorId);
    void realtimeClient.publishMany([
      {
        domain: 'users',
        action: 'admin.user.role.updated',
        entityId: userId,
        scope: { roles: ['ADMIN'] },
      },
      {
        domain: 'audit',
        action: 'log.created',
        scope: { roles: ['ADMIN'] },
      },
    ]);
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
