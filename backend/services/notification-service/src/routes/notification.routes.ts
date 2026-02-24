import express from 'express';
import { healthCheck } from '../controller/health.controller';
import { NotificationController } from '../controller/notification.controller';
import {
  requireApprovedAccount,
  requireAuth,
  requireInternalService,
} from '../middleware/auth.middleware';

const router = express.Router();
const notificationController = new NotificationController();

router.get('/health', healthCheck);

router.get(
  '/notifications',
  requireAuth,
  requireApprovedAccount,
  notificationController.listNotifications.bind(notificationController),
);

router.get(
  '/notifications/unread-count',
  requireAuth,
  requireApprovedAccount,
  notificationController.getUnreadCount.bind(notificationController),
);

router.patch(
  '/notifications/:id/read',
  requireAuth,
  requireApprovedAccount,
  notificationController.markNotificationRead.bind(notificationController),
);

router.patch(
  '/notifications/read-all',
  requireAuth,
  requireApprovedAccount,
  notificationController.markAllRead.bind(notificationController),
);

router.post(
  '/notifications/system',
  requireInternalService,
  notificationController.createSystemNotification.bind(notificationController),
);

export default router;
