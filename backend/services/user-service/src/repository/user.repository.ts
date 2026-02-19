import { PrismaClient, Prisma, User, Status, Role } from '../../../../db/node_modules/@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { CreateUserDto, UpsertStudentProfileDto, UserRole, UserStatus } from '../dto/user.dto';
import { ENV } from '../config/env';

const prismaAdapter = new PrismaPg({ connectionString: ENV.DATABASE_URL });
const prisma = new PrismaClient({ adapter: prismaAdapter });

export type UserWithProfile = Prisma.UserGetPayload<{ include: { profile: true } }>;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const normalizeOptionalString = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toPrismaRole = (role?: UserRole): Role => {
  if (!role) {
    return Role.STUDENT;
  }

  return Role[role];
};

const toPrismaStatus = (status: UserStatus): Status => Status[status];

export class UserRepository {
  async listUsers(): Promise<UserWithProfile[]> {
    return prisma.user.findMany({
      include: { profile: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEmail(email: string): Promise<UserWithProfile | null> {
    const normalized = normalizeEmail(email);
    return prisma.user.findUnique({
      where: { email: normalized },
      include: { profile: true },
    });
  }

  async createUser(data: CreateUserDto): Promise<UserWithProfile> {
    return prisma.user.create({
      data: {
        email: normalizeEmail(data.email),
        firstName: data.firstName.trim(),
        middleName: normalizeOptionalString(data.middleName),
        lastName: data.lastName.trim(),
        role: toPrismaRole(data.role),
        status: Status.PENDING,
      },
      include: { profile: true },
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
  ): Promise<UserWithProfile> {
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
      include: { profile: true },
    });
  }

  async getUserById(userId: string): Promise<UserWithProfile | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
  }

  async upsertStudentProfileByUserId(userId: string, data: UpsertStudentProfileDto): Promise<UserWithProfile> {
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
      include: { profile: true },
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
}
