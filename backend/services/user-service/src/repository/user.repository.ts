import { Prisma } from '@prisma/client';
export type User = Prisma.UserGetPayload<{}>;
import { prisma } from '../db/prisma';

export class UserRepository {
  async create(
    data: Prisma.UserCreateInput
  ): Promise<User> {
    return prisma.user.create({ data });
  }

  async findById(
    id: string
  ): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findByClerkId(clerkId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { clerkId },
    });
  }

  async update(
    id: string,
    data: Prisma.UserUpdateInput
  ): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(
    id: string
  ): Promise<User> {
    return prisma.user.delete({
      where: { id },
    });
  }

  async list(): Promise<User[]> {
    return prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
