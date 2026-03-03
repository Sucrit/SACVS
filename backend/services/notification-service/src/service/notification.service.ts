import {
  NotificationType,
  Prisma,
} from '../../../../db/node_modules/@prisma/client';
import {
  CreateSystemNotificationDto,
  ListNotificationsQueryDto,
  UpdateNotificationReadDto,
} from '../dto/notification.dto';
import { NotificationRepository } from '../repository/notification.repository';
import { realtimeClient } from '../client/realtime.client';

const notificationRepository = new NotificationRepository();
const VALID_NOTIFICATION_TYPES = new Set(Object.values(NotificationType));

const parseRequiredString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export class NotificationService {
  async createSystemNotification(data: CreateSystemNotificationDto) {
    const userId = parseRequiredString(data.userId);
    const title = parseRequiredString(data.title);
    const message = parseRequiredString(data.message);

    if (!userId) throw new Error('USER_ID_REQUIRED');
    if (!title) throw new Error('TITLE_REQUIRED');
    if (!message) throw new Error('MESSAGE_REQUIRED');
    if (!VALID_NOTIFICATION_TYPES.has(data.type)) throw new Error('INVALID_NOTIFICATION_TYPE');

    const userExists = await notificationRepository.userExists(userId);
    if (!userExists) throw new Error('USER_NOT_FOUND');

    const created = await notificationRepository.createNotification({
      userId,
      type: data.type,
      title,
      message,
      metadata: data.metadata === null ? Prisma.JsonNull : data.metadata,
    });
    void realtimeClient.publishMany([
      {
        domain: 'notifications',
        action: 'notification.created',
        entityId: created.id,
        scope: { userIds: [created.userId] },
      },
    ]);
    return created;
  }

  async listUserNotifications(userId: string, query: ListNotificationsQueryDto) {
    const normalizedUserId = parseRequiredString(userId);
    if (!normalizedUserId) throw new Error('USER_ID_REQUIRED');

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 50));
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      notificationRepository.listNotifications(normalizedUserId, query.read, skip, pageSize),
      notificationRepository.countNotifications(normalizedUserId, query.read),
    ]);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
      },
    };
  }

  async getUnreadCount(userId: string) {
    const normalizedUserId = parseRequiredString(userId);
    if (!normalizedUserId) throw new Error('USER_ID_REQUIRED');

    const unreadCount = await notificationRepository.countNotifications(normalizedUserId, false);
    return { unreadCount };
  }

  async updateNotificationReadState(
    userId: string,
    notificationId: string,
    payload: UpdateNotificationReadDto,
  ) {
    const normalizedUserId = parseRequiredString(userId);
    if (!normalizedUserId) throw new Error('USER_ID_REQUIRED');

    const normalizedNotificationId = parseRequiredString(notificationId);
    if (!normalizedNotificationId) throw new Error('NOTIFICATION_ID_REQUIRED');

    const notification = await notificationRepository.getNotificationById(normalizedNotificationId);
    if (!notification || notification.userId !== normalizedUserId) {
      throw new Error('NOTIFICATION_NOT_FOUND');
    }

    const updated = await notificationRepository.updateNotification(normalizedNotificationId, {
      read: payload.read,
    });
    void realtimeClient.publishMany([
      {
        domain: 'notifications',
        action: 'notification.updated',
        entityId: updated.id,
        scope: { userIds: [updated.userId] },
      },
    ]);
    return updated;
  }

  async markAllAsRead(userId: string) {
    const normalizedUserId = parseRequiredString(userId);
    if (!normalizedUserId) throw new Error('USER_ID_REQUIRED');

    const count = await notificationRepository.markAllAsRead(normalizedUserId);
    if (count > 0) {
      void realtimeClient.publishMany([
        {
          domain: 'notifications',
          action: 'notification.all_read',
          scope: { userIds: [normalizedUserId] },
          payload: { updatedCount: count },
        },
      ]);
    }
    return { updatedCount: count };
  }
}
