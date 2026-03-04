import {
  PrismaClient,
  Prisma,
  User,
  Status,
  Role,
  Sex,
  AuditAction,
  AuditSeverity,
  StepUpAction,
} from '../../../../db/node_modules/@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CreateInstitutionStudentDto,
  CreateUserDto,
  StudentSex,
  UpsertStudentProfileDto,
  UserRole,
  UserStatus,
} from '../dto/user.dto';
import { ENV } from '../config/env';

const prismaAdapter = new PrismaPg({ connectionString: ENV.DATABASE_URL });
const prisma = new PrismaClient({ adapter: prismaAdapter });

const userInclude = {
  profile: true,
  employer: true,
  institution: true,
};

const adminUserInclude = {
  employer: {
    select: {
      id: true,
      companyName: true,
      email: true,
    },
  },
  institution: {
    select: {
      id: true,
      institutionName: true,
      email: true,
    },
  },
};

export type UserWithRelations = Prisma.UserGetPayload<{ include: typeof userInclude }>;
export type AdminUserWithRelations = Prisma.UserGetPayload<{ include: typeof adminUserInclude }>;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const normalizeOptionalString = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeOptionalProfileString = (value?: string | null): string | null | undefined => {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeRequiredProfileString = (value?: string | null): string => {
  if (typeof value === 'undefined' || value === null) return '';
  return value.trim();
};

const toPrismaSex = (value?: StudentSex | null): Sex | null | undefined => {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  return Sex[value];
};

const normalizeBirthday = (value?: string | null): Date | null | undefined => {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const INSTITUTION_MANAGED_PROFILE_DEFAULTS = {
  street: '',
  barangay: '',
  city: '',
  province: '',
  zipCode: 0,
  phone: '',
} as const;

const buildStudentProfileWriteData = (
  data: UpsertStudentProfileDto,
): Prisma.StudentProfileCreateWithoutUserInput => ({
  studentNumber: data.studentNumber.trim(),
  street: data.street.trim(),
  barangay: data.barangay.trim(),
  city: data.city.trim(),
  province: data.province.trim(),
  zipCode: data.zipCode,
  phone: normalizeRequiredProfileString(data.phone),
  courseOfStudy: data.courseOfStudy.trim(),
  yearLevel: data.yearLevel.trim(),
  department: data.department.trim(),
  birthday: normalizeBirthday(data.birthday),
  sex: toPrismaSex(data.sex),
  guardianFullName: normalizeOptionalProfileString(data.guardianFullName),
  guardianRelationship: normalizeOptionalProfileString(data.guardianRelationship),
});

const buildInstitutionManagedStudentProfileCreateData = (
  data: CreateInstitutionStudentDto,
): Prisma.StudentProfileCreateWithoutUserInput => ({
  studentNumber: data.studentNumber.trim(),
  street: INSTITUTION_MANAGED_PROFILE_DEFAULTS.street,
  barangay: INSTITUTION_MANAGED_PROFILE_DEFAULTS.barangay,
  city: INSTITUTION_MANAGED_PROFILE_DEFAULTS.city,
  province: INSTITUTION_MANAGED_PROFILE_DEFAULTS.province,
  zipCode: INSTITUTION_MANAGED_PROFILE_DEFAULTS.zipCode,
  phone: INSTITUTION_MANAGED_PROFILE_DEFAULTS.phone,
  courseOfStudy: data.courseOfStudy.trim(),
  yearLevel: data.yearLevel.trim(),
  department: data.department.trim(),
});

const buildInstitutionManagedStudentProfileUpdateData = (
  data: CreateInstitutionStudentDto,
): Prisma.StudentProfileUpdateWithoutUserInput => ({
  studentNumber: data.studentNumber.trim(),
  courseOfStudy: data.courseOfStudy.trim(),
  yearLevel: data.yearLevel.trim(),
  department: data.department.trim(),
});

const toPrismaRole = (role?: UserRole): Role => {
  switch (role) {
    case 'ADMIN':
      return Role.ADMIN;
    case 'EMPLOYER':
      return Role.EMPLOYER;
    case 'INSTITUTION':
      return Role.INSTITUTION;
    case 'STUDENT':
    default:
      return Role.STUDENT;
  }
};

const toPrismaStatus = (status: UserStatus): Status => Status[status];

export class UserRepository {
  private async getActorAuditIdentity(
    actorId: string | null | undefined,
    tx: Prisma.TransactionClient | PrismaClient = prisma,
  ): Promise<{ actorEmail: string | null; actorRole: Role | null }> {
    if (!actorId) {
      return { actorEmail: null, actorRole: null };
    }

    const actor = await tx.user.findUnique({
      where: { id: actorId },
      select: {
        email: true,
        role: true,
      },
    });

    return {
      actorEmail: actor?.email ?? null,
      actorRole: actor?.role ?? null,
    };
  }

  private async createAuditLogEntry(
    data: {
      action: AuditAction;
      severity?: AuditSeverity;
      actorId?: string | null;
      targetType?: string | null;
      targetId?: string | null;
      description?: string | null;
      metadata?: Prisma.InputJsonValue | null;
    },
    tx: Prisma.TransactionClient | PrismaClient = prisma,
  ): Promise<void> {
    const actorIdentity = await this.getActorAuditIdentity(data.actorId, tx);

    await tx.auditLog.create({
      data: {
        action: data.action,
        severity: data.severity ?? AuditSeverity.INFO,
        actorId: data.actorId ?? null,
        actorEmail: actorIdentity.actorEmail,
        actorRole: actorIdentity.actorRole,
        targetType: data.targetType ?? null,
        targetId: data.targetId ?? null,
        description: data.description ?? null,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  async getUserContextById(userId: string): Promise<{
    id: string;
    role: Role;
    status: Status;
    institutionId: string | null;
    employerId: string | null;
  } | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        institutionId: true,
        employerId: true,
      },
    });
  }

  async listUsers(): Promise<UserWithRelations[]> {
    return prisma.user.findMany({
      include: userInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async listUsersForAdmin(): Promise<AdminUserWithRelations[]> {
    return prisma.user.findMany({
      include: adminUserInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async listInstitutionStudents(institutionId: string): Promise<UserWithRelations[]> {
    return prisma.user.findMany({
      where: {
        role: Role.STUDENT,
        institutionId,
      },
      include: userInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInstitutionStudentIdentity(
    institutionId: string,
    studentUserId: string,
  ): Promise<{ id: string; email: string } | null> {
    return prisma.user.findFirst({
      where: {
        id: studentUserId,
        role: Role.STUDENT,
        institutionId,
      },
      select: {
        id: true,
        email: true,
      },
    });
  }

  async getUserDisplayNamesByIds(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
      },
    });

    const names = new Map<string, string>();
    users.forEach(user => {
      const displayName = [user.firstName, user.middleName, user.lastName]
        .filter(value => typeof value === 'string' && value.trim().length > 0)
        .join(' ')
        .trim();
      if (displayName.length > 0) {
        names.set(user.id, displayName);
      }
    });

    return names;
  }

  async findByEmail(email: string): Promise<UserWithRelations | null> {
    const normalized = normalizeEmail(email);
    return prisma.user.findUnique({
      where: { email: normalized },
      include: userInclude,
    });
  }

  async createUser(data: CreateUserDto): Promise<UserWithRelations> {
    return prisma.user.create({
      data: {
        email: normalizeEmail(data.email),
        firstName: data.firstName.trim(),
        middleName: normalizeOptionalString(data.middleName),
        lastName: data.lastName.trim(),
        role: toPrismaRole(data.role),
        status: Status.PENDING,
      },
      include: userInclude,
    });
  }

  async createInstitutionStudentByClerkUserId(
    clerkUserId: string,
    institutionId: string,
    data: CreateInstitutionStudentDto,
    actorId?: string | null,
  ): Promise<UserWithRelations> {
    const normalizedEmail = normalizeEmail(data.email);
    const existingByEmail = await this.findByEmail(normalizedEmail);
    if (existingByEmail && existingByEmail.id !== clerkUserId) {
      throw new Error('EMAIL_ALREADY_LINKED_TO_ANOTHER_ACCOUNT');
    }

    const status = Status.APPROVED;
    const approvedById = actorId ?? null;
    const approvedAt = new Date();

    return prisma.user.upsert({
      where: { id: clerkUserId },
      create: {
        id: clerkUserId,
        email: normalizedEmail,
        firstName: data.firstName.trim(),
        middleName: normalizeOptionalString(data.middleName),
        lastName: data.lastName.trim(),
        role: Role.STUDENT,
        status,
        institutionId,
        employerId: null,
        approvedById,
        approvedAt,
        profile: {
          create: buildInstitutionManagedStudentProfileCreateData(data),
        },
      },
      update: {
        email: normalizedEmail,
        firstName: data.firstName.trim(),
        middleName: normalizeOptionalString(data.middleName),
        lastName: data.lastName.trim(),
        role: Role.STUDENT,
        status,
        institutionId,
        employerId: null,
        approvedById,
        approvedAt,
        profile: {
          upsert: {
            create: buildInstitutionManagedStudentProfileCreateData(data),
            update: buildInstitutionManagedStudentProfileUpdateData(data),
          },
        },
      },
      include: userInclude,
    });
  }

  async upsertStudentOnboardingByClerkUserId(
    clerkUserId: string,
    data: {
      email: string;
      firstName: string;
      middleName?: string | null;
      lastName: string;
      profile: UpsertStudentProfileDto;
    },
  ): Promise<UserWithRelations> {
    const normalizedEmail = normalizeEmail(data.email);
    const existingByEmail = await this.findByEmail(normalizedEmail);
    if (existingByEmail && existingByEmail.id !== clerkUserId) {
      throw new Error('EMAIL_ALREADY_LINKED_TO_ANOTHER_ACCOUNT');
    }

    return prisma.user.upsert({
      where: { id: clerkUserId },
      create: {
        id: clerkUserId,
        email: normalizedEmail,
        firstName: data.firstName.trim(),
        middleName: normalizeOptionalString(data.middleName),
        lastName: data.lastName.trim(),
        role: Role.STUDENT,
        status: Status.PENDING,
        profile: {
          create: buildStudentProfileWriteData(data.profile),
        },
      },
      update: {
        email: normalizedEmail,
        firstName: data.firstName.trim(),
        middleName: normalizeOptionalString(data.middleName),
        lastName: data.lastName.trim(),
        role: Role.STUDENT,
        profile: {
          upsert: {
            create: buildStudentProfileWriteData(data.profile),
            update: buildStudentProfileWriteData(data.profile),
          },
        },
      },
      include: userInclude,
    });
  }

  async upsertOrganizationOnboardingByClerkUserId(
    clerkUserId: string,
    data: {
      userEmail: string;
      firstName: string;
      middleName?: string | null;
      lastName: string;
      role: 'EMPLOYER' | 'INSTITUTION';
      registrationNumber: string;
      organizationEmail: string;
      phoneNumber: string;
      employer?: {
        companyName: string;
        taxId: string;
      };
      institution?: {
        institutionName: string;
        accreditationNumber: string;
      };
    },
  ): Promise<UserWithRelations> {
    const normalizedUserEmail = normalizeEmail(data.userEmail);
    const existingByEmail = await this.findByEmail(normalizedUserEmail);
    if (existingByEmail && existingByEmail.id !== clerkUserId) {
      throw new Error('EMAIL_ALREADY_LINKED_TO_ANOTHER_ACCOUNT');
    }

    const normalizedOrgEmail = normalizeEmail(data.organizationEmail);

    return prisma.$transaction(async tx => {
      if (data.role === 'EMPLOYER') {
        if (!data.employer) {
          throw new Error('EMPLOYER_PAYLOAD_MISSING');
        }

        const employer = await tx.employer.upsert({
          where: { email: normalizedOrgEmail },
          create: {
            companyName: data.employer.companyName,
            registrationNumber: data.registrationNumber,
            taxId: data.employer.taxId,
            email: normalizedOrgEmail,
            phoneNumber: data.phoneNumber,
          },
          update: {
            companyName: data.employer.companyName,
            registrationNumber: data.registrationNumber,
            taxId: data.employer.taxId,
            email: normalizedOrgEmail,
            phoneNumber: data.phoneNumber,
          },
        });

        return tx.user.upsert({
          where: { id: clerkUserId },
          create: {
            id: clerkUserId,
            email: normalizedUserEmail,
            firstName: data.firstName,
            middleName: normalizeOptionalString(data.middleName),
            lastName: data.lastName,
            role: Role.EMPLOYER,
            status: Status.PENDING,
            employerId: employer.id,
            institutionId: null,
          },
          update: {
            email: normalizedUserEmail,
            firstName: data.firstName,
            middleName: normalizeOptionalString(data.middleName),
            lastName: data.lastName,
            role: Role.EMPLOYER,
            status: Status.PENDING,
            approvedById: null,
            approvedAt: null,
            employerId: employer.id,
            institutionId: null,
          },
          include: userInclude,
        });
      }

      if (!data.institution) {
        throw new Error('INSTITUTION_PAYLOAD_MISSING');
      }

      const institution = await tx.institution.upsert({
        where: { email: normalizedOrgEmail },
        create: {
          institutionName: data.institution.institutionName,
          accreditationNumber: data.institution.accreditationNumber,
          registrationNumber: data.registrationNumber,
          email: normalizedOrgEmail,
          phoneNumber: data.phoneNumber,
        },
        update: {
          institutionName: data.institution.institutionName,
          accreditationNumber: data.institution.accreditationNumber,
          registrationNumber: data.registrationNumber,
          email: normalizedOrgEmail,
          phoneNumber: data.phoneNumber,
        },
      });

      return tx.user.upsert({
        where: { id: clerkUserId },
        create: {
          id: clerkUserId,
          email: normalizedUserEmail,
          firstName: data.firstName,
          middleName: normalizeOptionalString(data.middleName),
          lastName: data.lastName,
          role: Role.INSTITUTION,
          status: Status.PENDING,
          employerId: null,
          institutionId: institution.id,
        },
        update: {
          email: normalizedUserEmail,
          firstName: data.firstName,
          middleName: normalizeOptionalString(data.middleName),
          lastName: data.lastName,
          role: Role.INSTITUTION,
          status: Status.PENDING,
          approvedById: null,
          approvedAt: null,
          employerId: null,
          institutionId: institution.id,
        },
        include: userInclude,
      });
    });
  }

  async getUserById(userId: string): Promise<UserWithRelations | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      include: userInclude,
    });
  }

  async getUserByIdForAdmin(userId: string): Promise<AdminUserWithRelations | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      include: adminUserInclude,
    });
  }

  async upsertStudentProfileByUserId(userId: string, data: UpsertStudentProfileDto): Promise<UserWithRelations> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        profile: {
          upsert: {
            create: buildStudentProfileWriteData(data),
            update: buildStudentProfileWriteData(data),
          },
        },
      },
      include: userInclude,
    });
  }

  async updateUserStatus(userId: string, status: UserStatus, actorId?: string | null): Promise<User> {
    const normalizedActorId = actorId ?? null;
    const approvedAt = status === 'APPROVED' ? new Date() : null;
    const nextStatus = toPrismaStatus(status);
    const actionByStatus: Record<UserStatus, AuditAction> = {
      APPROVED: AuditAction.USER_APPROVED,
      REJECTED: AuditAction.USER_REJECTED,
      SUSPENDED: AuditAction.USER_SUSPENDED,
      PENDING: AuditAction.SETTINGS_CHANGED,
    };

    return prisma.$transaction(async tx => {
      const previous = await tx.user.findUnique({
        where: { id: userId },
        select: {
          status: true,
        },
      });
      if (previous?.status === nextStatus) {
        throw new Error('STATUS_UNCHANGED');
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          status: nextStatus,
          approvedById: status === 'APPROVED' ? normalizedActorId : null,
          approvedAt,
        },
      });

      await this.createAuditLogEntry(
        {
          action: actionByStatus[status],
          actorId: normalizedActorId,
          targetType: 'User',
          targetId: userId,
          description: `User status changed from ${previous?.status ?? 'UNKNOWN'} to ${status}`,
          metadata: {
            previousStatus: previous?.status ?? null,
            nextStatus: status,
          },
        },
        tx,
      );

      return updated;
    });
  }

  async updateUserRole(
    userId: string,
    role: UserRole,
    actorId?: string | null,
  ): Promise<AdminUserWithRelations> {
    return prisma.$transaction(async tx => {
      const previous = await tx.user.findUnique({
        where: { id: userId },
        select: {
          role: true,
        },
      });

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          role: toPrismaRole(role),
        },
        include: adminUserInclude,
      });

      await this.createAuditLogEntry(
        {
          action: AuditAction.ROLE_CHANGED,
          actorId: actorId ?? null,
          targetType: 'User',
          targetId: userId,
          description: `User role changed from ${previous?.role ?? 'UNKNOWN'} to ${role}`,
          metadata: {
            previousRole: previous?.role ?? null,
            nextRole: role,
          },
        },
        tx,
      );

      return updated;
    });
  }

  async updateInstitutionStudentStatus(
    institutionId: string,
    studentUserId: string,
    status: UserStatus,
    actorId?: string | null,
  ): Promise<UserWithRelations | null> {
    const target = await prisma.user.findFirst({
      where: {
        id: studentUserId,
        role: Role.STUDENT,
        institutionId,
      },
      select: { id: true },
    });

    if (!target) {
      return null;
    }

    const approvedAt = status === 'APPROVED' ? new Date() : null;
    const nextStatus = toPrismaStatus(status);

    return prisma.$transaction(async tx => {
      const previous = await tx.user.findUnique({
        where: { id: studentUserId },
        select: {
          status: true,
        },
      });
      if (previous?.status === nextStatus) {
        throw new Error('STATUS_UNCHANGED');
      }

      const updated = await tx.user.update({
        where: { id: studentUserId },
        data: {
          status: nextStatus,
          approvedById: status === 'APPROVED' ? actorId ?? null : null,
          approvedAt,
        },
        include: userInclude,
      });

      await this.createAuditLogEntry(
        {
          action:
            status === 'APPROVED'
              ? AuditAction.USER_APPROVED
              : status === 'REJECTED'
                ? AuditAction.USER_REJECTED
                : status === 'SUSPENDED'
                  ? AuditAction.USER_SUSPENDED
                  : AuditAction.SETTINGS_CHANGED,
          actorId: actorId ?? null,
          targetType: 'User',
          targetId: studentUserId,
          description: `Institution updated student status from ${previous?.status ?? 'UNKNOWN'} to ${status}`,
          metadata: {
            previousStatus: previous?.status ?? null,
            nextStatus: status,
          },
        },
        tx,
      );

      return updated;
    });
  }

  async updateInstitutionStudent(
    institutionId: string,
    studentUserId: string,
    data: CreateInstitutionStudentDto,
    actorId?: string | null,
  ): Promise<UserWithRelations | null> {
    const target = await this.getInstitutionStudentIdentity(institutionId, studentUserId);
    if (!target) {
      return null;
    }

    const normalizedEmail = normalizeEmail(data.email);
    const existingByEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existingByEmail && existingByEmail.id !== studentUserId) {
      throw new Error('EMAIL_ALREADY_LINKED_TO_ANOTHER_ACCOUNT');
    }

    const status = toPrismaStatus(data.status ?? 'PENDING');
    const approvedAt = status === Status.APPROVED ? new Date() : null;

    return prisma.$transaction(async tx => {
      const updated = await tx.user.update({
        where: { id: studentUserId },
        data: {
          email: normalizedEmail,
          firstName: data.firstName.trim(),
          middleName: normalizeOptionalString(data.middleName),
          lastName: data.lastName.trim(),
          role: Role.STUDENT,
          status,
          institutionId,
          employerId: null,
          approvedById: status === Status.APPROVED ? actorId ?? null : null,
          approvedAt,
          profile: {
            upsert: {
              create: buildInstitutionManagedStudentProfileCreateData(data),
              update: buildInstitutionManagedStudentProfileUpdateData(data),
            },
          },
        },
        include: userInclude,
      });

      await this.createAuditLogEntry(
        {
          action: AuditAction.SETTINGS_CHANGED,
          actorId: actorId ?? null,
          targetType: 'User',
          targetId: studentUserId,
          description: 'Institution updated student profile',
          metadata: {
            email: normalizedEmail,
            status,
          },
        },
        tx,
      );

      return updated;
    });
  }

  async deleteInstitutionStudentAccount(
    institutionId: string,
    studentUserId: string,
    actorId?: string | null,
  ): Promise<{ id: string; email: string } | null> {
    const target = await this.getInstitutionStudentIdentity(institutionId, studentUserId);
    if (!target) {
      return null;
    }

    return prisma.$transaction(async tx => {
      await tx.credentialRequest.deleteMany({
        where: {
          OR: [
            { studentId: studentUserId },
            { requesterId: studentUserId },
            { processedById: studentUserId },
          ],
        },
      });

      await tx.credential.deleteMany({
        where: {
          OR: [
            { studentId: studentUserId },
            { issuedById: studentUserId },
          ],
        },
      });

      await tx.auditLog.deleteMany({
        where: { actorId: studentUserId },
      });

      const deleted = await tx.user.delete({
        where: { id: studentUserId },
        select: {
          id: true,
          email: true,
        },
      });

      await this.createAuditLogEntry(
        {
          action: AuditAction.USER_DELETED,
          actorId: actorId ?? null,
          targetType: 'User',
          targetId: deleted.id,
          description: `Institution deleted student account ${deleted.email}`,
          metadata: {
            email: deleted.email,
          },
        },
        tx,
      );

      return deleted;
    });
  }

  async createInstitutionStudentAudit(
    actorId: string,
    studentId: string,
    studentEmail: string,
  ): Promise<void> {
    await this.createAuditLogEntry({
      action: AuditAction.USER_CREATED,
      actorId,
      targetType: 'User',
      targetId: studentId,
      description: `Institution created student account ${studentEmail}`,
      metadata: {
        email: studentEmail,
      },
    });
  }

  async createAuditLog(data: {
    action: AuditAction;
    severity?: AuditSeverity;
    actorId?: string | null;
    targetType?: string | null;
    targetId?: string | null;
    description?: string | null;
    metadata?: Prisma.InputJsonValue | null;
  }): Promise<void> {
    await this.createAuditLogEntry(data);
  }

  async createStepUpChallenge(data: {
    userId: string;
    action: StepUpAction;
    targetId?: string | null;
    payloadHash?: string | null;
    codeHash: string;
    expiresAt: Date;
    maxAttempts: number;
  }): Promise<{ id: string; expiresAt: Date }> {
    return prisma.stepUpChallenge.create({
      data: {
        userId: data.userId,
        action: data.action,
        targetId: data.targetId ?? null,
        payloadHash: data.payloadHash ?? null,
        codeHash: data.codeHash,
        expiresAt: data.expiresAt,
        maxAttempts: data.maxAttempts,
      },
      select: {
        id: true,
        expiresAt: true,
      },
    });
  }

  async getStepUpChallengeById(challengeId: string, userId: string): Promise<{
    id: string;
    userId: string;
    action: StepUpAction;
    targetId: string | null;
    payloadHash: string | null;
    codeHash: string;
    expiresAt: Date;
    attempts: number;
    maxAttempts: number;
    lockedAt: Date | null;
    verifiedAt: Date | null;
  } | null> {
    return prisma.stepUpChallenge.findFirst({
      where: {
        id: challengeId,
        userId,
      },
      select: {
        id: true,
        userId: true,
        action: true,
        targetId: true,
        payloadHash: true,
        codeHash: true,
        expiresAt: true,
        attempts: true,
        maxAttempts: true,
        lockedAt: true,
        verifiedAt: true,
      },
    });
  }

  async markStepUpChallengeAttempt(challengeId: string, attempts: number, lock: boolean): Promise<void> {
    await prisma.stepUpChallenge.update({
      where: { id: challengeId },
      data: {
        attempts,
        lockedAt: lock ? new Date() : null,
      },
    });
  }

  async verifyStepUpChallengeAndCreateSession(data: {
    challengeId: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<{ sessionId: string; expiresAt: Date }> {
    return prisma.$transaction(async tx => {
      const challenge = await tx.stepUpChallenge.findFirst({
        where: {
          id: data.challengeId,
          userId: data.userId,
          verifiedAt: null,
          lockedAt: null,
        },
        select: {
          id: true,
          action: true,
          targetId: true,
          payloadHash: true,
          expiresAt: true,
        },
      });

      if (!challenge || challenge.expiresAt <= new Date()) {
        throw new Error('STEP_UP_TOKEN_EXPIRED');
      }

      await tx.stepUpChallenge.update({
        where: { id: challenge.id },
        data: { verifiedAt: new Date() },
      });

      const session = await tx.stepUpSession.create({
        data: {
          challengeId: challenge.id,
          userId: data.userId,
          action: challenge.action,
          targetId: challenge.targetId,
          payloadHash: challenge.payloadHash,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
        },
        select: {
          id: true,
          expiresAt: true,
        },
      });

      return {
        sessionId: session.id,
        expiresAt: session.expiresAt,
      };
    });
  }

  async consumeStepUpSessionAtomically(data: {
    tokenHash: string;
    userId: string;
    action: StepUpAction;
    targetId?: string | null;
    payloadHash?: string | null;
    now: Date;
  }): Promise<'CONSUMED' | 'INVALID' | 'EXPIRED' | 'USED' | 'MISMATCH'> {
    return prisma.$transaction(async tx => {
      const candidate = await tx.stepUpSession.findUnique({
        where: { tokenHash: data.tokenHash },
        select: {
          id: true,
          userId: true,
          action: true,
          targetId: true,
          payloadHash: true,
          expiresAt: true,
          usedAt: true,
        },
      });

      if (!candidate) return 'INVALID';
      if (candidate.usedAt) return 'USED';
      if (candidate.expiresAt <= data.now) return 'EXPIRED';

      if (candidate.userId !== data.userId || candidate.action !== data.action) return 'MISMATCH';
      if ((candidate.targetId ?? null) !== (data.targetId ?? null)) return 'MISMATCH';
      if ((candidate.payloadHash ?? null) !== (data.payloadHash ?? null)) return 'MISMATCH';

      const updated = await tx.stepUpSession.updateMany({
        where: {
          id: candidate.id,
          usedAt: null,
          expiresAt: { gt: data.now },
        },
        data: {
          usedAt: data.now,
        },
      });

      if (updated.count !== 1) return 'USED';
      return 'CONSUMED';
    });
  }

  async listAuditLogsForRoleScope(actor: {
    id: string;
    role: Role;
    institutionId: string | null;
    employerId: string | null;
  }): Promise<Array<{
    id: string;
    action: AuditAction;
    severity: AuditSeverity;
    actorId: string | null;
    actorEmail: string | null;
    actorRole: Role | null;
    targetType: string | null;
    targetId: string | null;
    description: string | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
  }>> {
    const baseSelect = {
      id: true,
      action: true,
      severity: true,
      actorId: true,
      actorEmail: true,
      actorRole: true,
      targetType: true,
      targetId: true,
      description: true,
      metadata: true,
      createdAt: true,
    } satisfies Prisma.AuditLogSelect;

    if (actor.role === Role.ADMIN) {
      return prisma.auditLog.findMany({
        where: {
          OR: [
            { actorRole: Role.ADMIN },
            {
              action: {
                in: [
                  AuditAction.USER_APPROVED,
                  AuditAction.USER_REJECTED,
                  AuditAction.USER_SUSPENDED,
                  AuditAction.ROLE_CHANGED,
                  AuditAction.ROLE_ASSIGNED,
                  AuditAction.ROLE_REMOVED,
                  AuditAction.USER_PERMISSIONS_UPDATED,
                  AuditAction.SETTINGS_CHANGED,
                  AuditAction.SECURITY_ALERT,
                  AuditAction.SECURITY_INCIDENT,
                ],
              },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 250,
        select: baseSelect,
      });
    }

    if (actor.role === Role.INSTITUTION && actor.institutionId) {
      return prisma.auditLog.findMany({
        where: {
          actor: {
            institutionId: actor.institutionId,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 250,
        select: baseSelect,
      });
    }

    if (actor.role === Role.EMPLOYER && actor.employerId) {
      return prisma.auditLog.findMany({
        where: {
          actor: {
            employerId: actor.employerId,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 250,
        select: baseSelect,
      });
    }

    return [];
  }

}
