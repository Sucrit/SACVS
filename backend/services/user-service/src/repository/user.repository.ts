import { PrismaClient, User, Status } from '@prisma/client';
import { CreateUserDto } from '../dto/user.dto';

const prisma = new PrismaClient();

export class UserRepository {
  async createUser(data: CreateUserDto): Promise<User> {
    return prisma.user.create({
      data: {
        ...data,
        status: Status.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async getUserById(userId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async updateUserStatus(userId: string, status: Status): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { status },
    });
  }
}