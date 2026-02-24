import { NotificationType, Prisma } from '../../../../db/node_modules/@prisma/client';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { NotificationService } from '../service/notification.service';

const notificationService = new NotificationService();
const VALID_NOTIFICATION_TYPES = new Set(Object.values(NotificationType));

const parseBooleanQuery = (value: unknown, errorCode: string): boolean | undefined => {
  if (typeof value === 'undefined') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error(errorCode);
};

const parseJson = (value: unknown, errorCode: string): Prisma.InputJsonValue | null | undefined => {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return undefined;
    try {
      return JSON.parse(trimmed) as Prisma.InputJsonValue | null;
    } catch {
      throw new Error(errorCode);
    }
  }

  if (typeof value === 'object') {
    return value as Prisma.InputJsonValue;
  }

  throw new Error(errorCode);
};

export class NotificationController {
  private getAuthUserId(req: Request): string | null {
    return (req as AuthenticatedRequest).auth?.sub ?? null;
  }

  private mapError(error: unknown, res: Response): Response | null {
    if (!(error instanceof Error)) return null;

    const map: Record<string, { code: number; error: string }> = {
      USER_ID_REQUIRED: { code: 400, error: 'Missing required field: userId' },
      TITLE_REQUIRED: { code: 400, error: 'Missing required field: title' },
      MESSAGE_REQUIRED: { code: 400, error: 'Missing required field: message' },
      INVALID_NOTIFICATION_TYPE: { code: 400, error: 'Invalid notification type.' },
      USER_NOT_FOUND: { code: 404, error: 'User not found.' },
      NOTIFICATION_ID_REQUIRED: { code: 400, error: 'Missing notification id.' },
      NOTIFICATION_NOT_FOUND: { code: 404, error: 'Notification not found.' },
      INVALID_READ_QUERY: { code: 400, error: 'Invalid read query value. Use true or false.' },
      INVALID_METADATA_JSON: { code: 400, error: 'Invalid metadata JSON value.' },
    };

    const mapped = map[error.message];
    if (mapped) return res.status(mapped.code).json({ error: mapped.error });

    return null;
  }

  async listNotifications(req: Request, res: Response): Promise<Response> {
    const userId = this.getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const read = parseBooleanQuery(req.query.read, 'INVALID_READ_QUERY');
      const page = typeof req.query.page === 'string' ? Number(req.query.page) : undefined;
      const pageSize = typeof req.query.pageSize === 'string' ? Number(req.query.pageSize) : undefined;

      const result = await notificationService.listUserNotifications(userId, { read, page, pageSize });
      return res.status(200).json(result);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error listing notifications:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async getUnreadCount(req: Request, res: Response): Promise<Response> {
    const userId = this.getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const result = await notificationService.getUnreadCount(userId);
      return res.status(200).json(result);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error getting unread notification count:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async markNotificationRead(req: Request, res: Response): Promise<Response> {
    const userId = this.getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const read = typeof req.body?.read === 'boolean' ? req.body.read : true;

    try {
      const updated = await notificationService.updateNotificationReadState(userId, notificationId, { read });
      return res.status(200).json(updated);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error updating notification read state:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async markAllRead(req: Request, res: Response): Promise<Response> {
    const userId = this.getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const result = await notificationService.markAllAsRead(userId);
      return res.status(200).json(result);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error marking all notifications as read:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async createSystemNotification(req: Request, res: Response): Promise<Response> {
    const userId = typeof req.body?.userId === 'string' ? req.body.userId : '';
    const title = typeof req.body?.title === 'string' ? req.body.title : '';
    const message = typeof req.body?.message === 'string' ? req.body.message : '';
    const typeRaw = typeof req.body?.type === 'string' ? req.body.type : '';

    if (!userId.trim()) {
      return res.status(400).json({ error: 'Missing required field: userId' });
    }
    if (!title.trim()) {
      return res.status(400).json({ error: 'Missing required field: title' });
    }
    if (!message.trim()) {
      return res.status(400).json({ error: 'Missing required field: message' });
    }
    if (!VALID_NOTIFICATION_TYPES.has(typeRaw as NotificationType)) {
      return res.status(400).json({ error: 'Invalid notification type.' });
    }

    try {
      const metadata = parseJson(req.body?.metadata, 'INVALID_METADATA_JSON');
      const created = await notificationService.createSystemNotification({
        userId,
        title,
        message,
        type: typeRaw as NotificationType,
        metadata,
      });

      return res.status(201).json(created);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error creating system notification:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
