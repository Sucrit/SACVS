import {
  NotificationType,
  Prisma,
} from '../../../../db/node_modules/@prisma/client';
import {
  CreateInstitutionBroadcastDto,
  CreateSystemNotificationDto,
  InstitutionNotificationTarget,
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

const VALID_INSTITUTION_NOTIFICATION_TARGETS = new Set<InstitutionNotificationTarget>([
  'ALL',
  'APPROVED_ONLY',
]);

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

  async createInstitutionBroadcast(params: {
    institutionId: string;
    actorUserId: string;
    payload: CreateInstitutionBroadcastDto;
  }) {
    const institutionId = parseRequiredString(params.institutionId);
    const actorUserId = parseRequiredString(params.actorUserId);
    const target = params.payload.target;
    const title = parseRequiredString(params.payload.title);
    const message = parseRequiredString(params.payload.message);

    if (!institutionId) throw new Error('INSTITUTION_ID_REQUIRED');
    if (!actorUserId) throw new Error('USER_ID_REQUIRED');
    if (!VALID_INSTITUTION_NOTIFICATION_TARGETS.has(target)) {
      throw new Error('INVALID_INSTITUTION_NOTIFICATION_TARGET');
    }
    if (!title) throw new Error('TITLE_REQUIRED');
    if (!message) throw new Error('MESSAGE_REQUIRED');

    const recipientUserIds = await notificationRepository.listInstitutionStudentRecipientIds(
      institutionId,
      target,
    );

    const broadcast = await notificationRepository.createInstitutionBroadcast({
      institutionId,
      createdById: actorUserId,
      targetScope: target,
      title,
      message,
      recipientCount: recipientUserIds.length,
      recipientUserIds,
      notificationMetadata: {
        event: 'INSTITUTION_BROADCAST',
        institutionId,
        targetScope: target,
      },
    });

    if (recipientUserIds.length > 0) {
      void realtimeClient.publishMany([
        {
          domain: 'notifications',
          action: 'notification.broadcast_created',
          entityId: broadcast.id,
          scope: { userIds: recipientUserIds },
          payload: { institutionId, recipientCount: recipientUserIds.length },
        },
      ]);
    }

    return {
      id: broadcast.id,
      target,
      title: broadcast.title,
      message: broadcast.message,
      recipientCount: broadcast.recipientCount,
      createdAt: broadcast.createdAt.toISOString(),
    };
  }

  async listInstitutionBroadcasts(institutionId: string) {
    const normalizedInstitutionId = parseRequiredString(institutionId);
    if (!normalizedInstitutionId) throw new Error('INSTITUTION_ID_REQUIRED');

    const items = await notificationRepository.listInstitutionBroadcasts(normalizedInstitutionId);
    return items.map(item => ({
      id: item.id,
      target: item.targetScope,
      title: item.title,
      message: item.message,
      recipientCount: item.recipientCount,
      createdAt: item.createdAt.toISOString(),
      createdByName: [item.createdBy.firstName, item.createdBy.middleName, item.createdBy.lastName]
        .filter(Boolean)
        .join(' ')
        .trim(),
      createdByEmail: item.createdBy.email,
    }));
  }
}
