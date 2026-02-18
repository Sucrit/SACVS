import { Prisma, NotificationType } from '@prisma/client';
import { prisma } from '../db/prisma';

export type Notification = Prisma.NotificationGetPayload<{}>;

export class NotificationRepository {
  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<Notification> {
    return prisma.notification.create({ data });
  }

  async listByUser(userId: string, options?: {
    unreadOnly?: boolean;
    skip?: number;
    take?: number;
  }): Promise<{ data: Notification[]; total: number }> {
    const where: Prisma.NotificationWhereInput = { userId };
    if (options?.unreadOnly) where.read = false;

    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: options?.skip,
        take: options?.take,
      }),
      prisma.notification.count({ where }),
    ]);

    return { data, total };
  }

  async markAsRead(id: string): Promise<Notification> {
    return prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return result.count;
  }

  async unreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, read: false },
    });
  }
}
