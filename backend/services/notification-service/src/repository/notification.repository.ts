import {
  Notification,
  NotificationBroadcast,
  Prisma,
  PrismaClient,
  Status,
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

  async createInstitutionBroadcast(data: {
    institutionId: string;
    createdById: string;
    targetScope: string;
    title: string;
    message: string;
    recipientCount: number;
    recipientUserIds: string[];
    notificationMetadata: Prisma.InputJsonValue | null;
  }): Promise<NotificationBroadcast> {
    return prisma.$transaction(async tx => {
      const broadcast = await tx.notificationBroadcast.create({
        data: {
          institutionId: data.institutionId,
          createdById: data.createdById,
          targetScope: data.targetScope,
          title: data.title,
          message: data.message,
          recipientCount: data.recipientCount,
        },
      });

      if (data.recipientUserIds.length > 0) {
        await tx.notification.createMany({
          data: data.recipientUserIds.map(userId => ({
            userId,
            type: 'SYSTEM_ANNOUNCEMENT',
            title: data.title,
            message: data.message,
            metadata: data.notificationMetadata === null ? Prisma.JsonNull : data.notificationMetadata,
          })),
        });
      }

      return broadcast;
    });
  }

  async listInstitutionBroadcasts(institutionId: string): Promise<Array<NotificationBroadcast & {
    createdBy: { firstName: string; middleName: string | null; lastName: string; email: string };
  }>> {
    return prisma.notificationBroadcast.findMany({
      where: { institutionId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
          },
        },
      },
      take: 100,
    });
  }

  async listInstitutionStudentRecipientIds(
    institutionId: string,
    target: 'ALL' | 'APPROVED_ONLY' | 'SUSPENDED_ONLY',
  ): Promise<string[]> {
    const statusFilter =
      target === 'APPROVED_ONLY'
        ? Status.APPROVED
        : target === 'SUSPENDED_ONLY'
          ? Status.SUSPENDED
          : undefined;

    const users = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        institutionId,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      select: { id: true },
    });

    return users.map(user => user.id);
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
