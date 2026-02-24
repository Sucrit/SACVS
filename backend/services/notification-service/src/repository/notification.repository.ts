import {
  Notification,
  Prisma,
  PrismaClient,
} from '../../../../db/node_modules/@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ENV } from '../config/env';

if (!ENV.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured for notification-service.');
}

const prismaAdapter = new PrismaPg({ connectionString: ENV.DATABASE_URL });
const prisma = new PrismaClient({ adapter: prismaAdapter });

export class NotificationRepository {
  async userExists(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    return Boolean(user);
  }

  async createNotification(data: Prisma.NotificationUncheckedCreateInput): Promise<Notification> {
    return prisma.notification.create({ data });
  }

  async listNotifications(
    userId: string,
    read: boolean | undefined,
    skip: number,
    take: number,
  ): Promise<Notification[]> {
    return prisma.notification.findMany({
      where: {
        userId,
        ...(typeof read === 'boolean' ? { read } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async countNotifications(userId: string, read: boolean | undefined): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        ...(typeof read === 'boolean' ? { read } : {}),
      },
    });
  }

  async getNotificationById(notificationId: string): Promise<Notification | null> {
    return prisma.notification.findUnique({
      where: { id: notificationId },
    });
  }

  async updateNotification(
    notificationId: string,
    data: Prisma.NotificationUncheckedUpdateInput,
  ): Promise<Notification> {
    return prisma.notification.update({
      where: { id: notificationId },
      data,
    });
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
      },
    });

    return result.count;
  }
}
