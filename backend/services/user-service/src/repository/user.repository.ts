import { PrismaClient, Prisma, User, Status, Role } from '../../../../db/node_modules/@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CreateInstitutionStudentDto,
  CreateUserDto,
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
      name: true,
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
  async getUserContextById(userId: string): Promise<{
    id: string;
    role: Role;
    status: Status;
    institutionId: string | null;
  } | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        institutionId: true,
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
  ): Promise<UserWithRelations> {
    const normalizedEmail = normalizeEmail(data.email);
    const existingByEmail = await this.findByEmail(normalizedEmail);
    if (existingByEmail && existingByEmail.id !== clerkUserId) {
      throw new Error('EMAIL_ALREADY_LINKED_TO_ANOTHER_ACCOUNT');
    }

    const status = toPrismaStatus(data.status ?? 'PENDING');

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
        profile: {
          create: {
            studentNumber: data.studentNumber.trim(),
            street: data.street.trim(),
            barangay: data.barangay.trim(),
            city: data.city.trim(),
            province: data.province.trim(),
            zipCode: data.zipCode,
            phone: data.phone.trim(),
            courseOfStudy: data.courseOfStudy.trim(),
            yearLevel: data.yearLevel.trim(),
            department: data.department.trim(),
          },
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
        approvedById: null,
        approvedAt: null,
        profile: {
          upsert: {
            create: {
              studentNumber: data.studentNumber.trim(),
              street: data.street.trim(),
              barangay: data.barangay.trim(),
              city: data.city.trim(),
              province: data.province.trim(),
              zipCode: data.zipCode,
              phone: data.phone.trim(),
              courseOfStudy: data.courseOfStudy.trim(),
              yearLevel: data.yearLevel.trim(),
              department: data.department.trim(),
            },
            update: {
              studentNumber: data.studentNumber.trim(),
              street: data.street.trim(),
              barangay: data.barangay.trim(),
              city: data.city.trim(),
              province: data.province.trim(),
              zipCode: data.zipCode,
              phone: data.phone.trim(),
              courseOfStudy: data.courseOfStudy.trim(),
              yearLevel: data.yearLevel.trim(),
              department: data.department.trim(),
            },
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
          create: {
            studentNumber: data.profile.studentNumber.trim(),
            street: data.profile.street.trim(),
            barangay: data.profile.barangay.trim(),
            city: data.profile.city.trim(),
            province: data.profile.province.trim(),
            zipCode: data.profile.zipCode,
            phone: data.profile.phone.trim(),
            courseOfStudy: data.profile.courseOfStudy.trim(),
            yearLevel: data.profile.yearLevel.trim(),
            department: data.profile.department.trim(),
          },
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
            create: {
              studentNumber: data.profile.studentNumber.trim(),
              street: data.profile.street.trim(),
              barangay: data.profile.barangay.trim(),
              city: data.profile.city.trim(),
              province: data.profile.province.trim(),
              zipCode: data.profile.zipCode,
              phone: data.profile.phone.trim(),
              courseOfStudy: data.profile.courseOfStudy.trim(),
              yearLevel: data.profile.yearLevel.trim(),
              department: data.profile.department.trim(),
            },
            update: {
              studentNumber: data.profile.studentNumber.trim(),
              street: data.profile.street.trim(),
              barangay: data.profile.barangay.trim(),
              city: data.profile.city.trim(),
              province: data.profile.province.trim(),
              zipCode: data.profile.zipCode,
              phone: data.profile.phone.trim(),
              courseOfStudy: data.profile.courseOfStudy.trim(),
              yearLevel: data.profile.yearLevel.trim(),
              department: data.profile.department.trim(),
            },
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
        name: string;
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
          name: data.institution.name,
          accreditationNumber: data.institution.accreditationNumber,
          registrationNumber: data.registrationNumber,
          email: normalizedOrgEmail,
          phoneNumber: data.phoneNumber,
        },
        update: {
          name: data.institution.name,
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
            create: {
              studentNumber: data.studentNumber.trim(),
              street: data.street.trim(),
              barangay: data.barangay.trim(),
              city: data.city.trim(),
              province: data.province.trim(),
              zipCode: data.zipCode,
              phone: data.phone.trim(),
              courseOfStudy: data.courseOfStudy.trim(),
              yearLevel: data.yearLevel.trim(),
              department: data.department.trim(),
            },
            update: {
              studentNumber: data.studentNumber.trim(),
              street: data.street.trim(),
              barangay: data.barangay.trim(),
              city: data.city.trim(),
              province: data.province.trim(),
              zipCode: data.zipCode,
              phone: data.phone.trim(),
              courseOfStudy: data.courseOfStudy.trim(),
              yearLevel: data.yearLevel.trim(),
              department: data.department.trim(),
            },
          },
        },
      },
      include: userInclude,
    });
  }

  async updateUserStatus(userId: string, status: UserStatus, actorId?: string | null): Promise<User> {
    const normalizedActorId = actorId ?? null;
    const approvedAt = status === 'APPROVED' ? new Date() : null;

    return prisma.user.update({
      where: { id: userId },
      data: {
        status: toPrismaStatus(status),
        approvedById: status === 'APPROVED' ? normalizedActorId : null,
        approvedAt,
      },
    });
  }

  async updateUserRole(userId: string, role: UserRole): Promise<AdminUserWithRelations> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        role: toPrismaRole(role),
      },
      include: adminUserInclude,
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

    return prisma.user.update({
      where: { id: studentUserId },
      data: {
        status: toPrismaStatus(status),
        approvedById: status === 'APPROVED' ? actorId ?? null : null,
        approvedAt,
      },
      include: userInclude,
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

    return prisma.user.update({
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
            create: {
              studentNumber: data.studentNumber.trim(),
              street: data.street.trim(),
              barangay: data.barangay.trim(),
              city: data.city.trim(),
              province: data.province.trim(),
              zipCode: data.zipCode,
              phone: data.phone.trim(),
              courseOfStudy: data.courseOfStudy.trim(),
              yearLevel: data.yearLevel.trim(),
              department: data.department.trim(),
            },
            update: {
              studentNumber: data.studentNumber.trim(),
              street: data.street.trim(),
              barangay: data.barangay.trim(),
              city: data.city.trim(),
              province: data.province.trim(),
              zipCode: data.zipCode,
              phone: data.phone.trim(),
              courseOfStudy: data.courseOfStudy.trim(),
              yearLevel: data.yearLevel.trim(),
              department: data.department.trim(),
            },
          },
        },
      },
      include: userInclude,
    });
  }

  async deleteInstitutionStudentAccount(
    institutionId: string,
    studentUserId: string,
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

      return tx.user.delete({
        where: { id: studentUserId },
        select: {
          id: true,
          email: true,
        },
      });
    });
  }
}
