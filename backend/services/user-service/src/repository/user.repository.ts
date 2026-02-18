import { Prisma, Role, Status } from '@prisma/client';
import { prisma } from '../db/prisma';

export type User = Prisma.UserGetPayload<{ include: { profile: true } }>;
export type UserWithoutProfile = Prisma.UserGetPayload<{}>;

const includeProfile = { profile: true } as const;

export class UserRepository {
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data, include: includeProfile });
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
      include: includeProfile,
    });
  }

  async findByClerkId(clerkId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { clerkId },
      include: includeProfile,
    });
  }

  async delete(id: string): Promise<User> {
    return prisma.user.delete({
      where: { id },
      include: includeProfile,
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
      include: includeProfile,
    });
  }

  async list(options?: {
    role?: Role;
    status?: Status;
    search?: string;
    skip?: number;
    take?: number;
  }): Promise<{ data: User[]; total: number }> {
    const where: Prisma.UserWhereInput = {};

    if (options?.role) where.role = options.role;
    if (options?.status) where.status = options.status;
    if (options?.search) {
      where.OR = [
        { email: { contains: options.search, mode: 'insensitive' } },
        { fullName: { contains: options.search, mode: 'insensitive' } },
        { clerkId: { contains: options.search, mode: 'insensitive' } },
        { profile: { studentNumber: { contains: options.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: includeProfile,
        orderBy: { createdAt: 'desc' },
        skip: options?.skip,
        take: options?.take,
      }),
      prisma.user.count({ where }),
    ]);

    return { data, total };
  }

  async createProfile(data: Prisma.StudentProfileCreateInput): Promise<Prisma.StudentProfileGetPayload<{}>> {
    return prisma.studentProfile.create({ data });
  }

  async updateProfile(userId: string, data: Prisma.StudentProfileUpdateInput): Promise<Prisma.StudentProfileGetPayload<{}>> {
    return prisma.studentProfile.update({
      where: { userId },
      data,
    });
  }

  async findProfileByUserId(userId: string): Promise<Prisma.StudentProfileGetPayload<{}> | null> {
    return prisma.studentProfile.findUnique({ where: { userId } });
  }

  async findProfileByStudentNumber(studentNumber: string): Promise<Prisma.StudentProfileGetPayload<{}> | null> {
    return prisma.studentProfile.findUnique({ where: { studentNumber } });
  }

  async countByRole(): Promise<Record<string, number>> {
    const counts = await prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true },
    });
    const result: Record<string, number> = {};
    for (const c of counts) {
      result[c.role] = c._count._all;
    }
    return result;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const counts = await prisma.user.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const result: Record<string, number> = {};
    for (const c of counts) {
      result[c.status] = c._count._all;
    }
    return result;
  }
}
