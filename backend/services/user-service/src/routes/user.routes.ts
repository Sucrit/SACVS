import { Router } from 'express';
import { UserController } from '../controller/user.controller';
import { healthCheck } from '../controller/health.controller';
import { requireAdmin } from '../middleware/admin.middleware';
import { requireAnyClerkAuth } from '../middleware/auth.middleware';

const router = Router();

// public
router.get('/health', healthCheck);

// self-registration / profile
router.post('/', requireAnyClerkAuth, UserController.createUser);
router.get('/me', requireAnyClerkAuth, UserController.getCurrentUser);
router.patch('/me/profile', requireAnyClerkAuth, UserController.updateProfile);

// notifications (authenticated user)
router.get('/me/notifications', requireAnyClerkAuth, UserController.getNotifications);
router.get('/me/notifications/unread-count', requireAnyClerkAuth, UserController.getUnreadCount);
router.patch('/me/notifications/read-all', requireAnyClerkAuth, UserController.markAllNotificationsRead);
router.patch('/me/notifications/:id/read', requireAnyClerkAuth, UserController.markNotificationRead);

// admin-only management
router.get('/', requireAnyClerkAuth, requireAdmin, UserController.getUsers);
router.get('/stats', requireAnyClerkAuth, requireAdmin, UserController.getUserStats);
router.get('/audit-logs', requireAnyClerkAuth, requireAdmin, UserController.getAuditLogs);
router.post('/admin/users', requireAnyClerkAuth, requireAdmin, UserController.adminCreateUser);
router.get('/admin/users/:id', requireAnyClerkAuth, requireAdmin, UserController.getUserById);
router.patch('/admin/users/:id/status', requireAnyClerkAuth, requireAdmin, UserController.updateUserStatus);
router.patch('/admin/users/:id/profile', requireAnyClerkAuth, requireAdmin, UserController.adminUpdateProfile);
router.delete('/:id', requireAnyClerkAuth, requireAdmin, UserController.deleteUser);

export default router;
