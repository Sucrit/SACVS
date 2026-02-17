import { Router } from 'express';
import { UserController } from '../controller/user.controller';
import { healthCheck } from '../controller/health.controller';
import { requireAuth } from '@clerk/express';
import { requireAdmin } from '../middleware/admin.middleware';

const router = Router();

// public
router.get('/health', healthCheck);
// self-registration / profile
router.post('/', requireAuth(), UserController.createUser);
router.get('/me', requireAuth(), UserController.getCurrentUser);
// admin-only management
router.get('/', requireAuth(), requireAdmin, UserController.getUsers);
router.post('/admin/users', requireAuth(), requireAdmin, UserController.adminCreateUser);
router.patch('/admin/users/:id/status', requireAuth(), requireAdmin, UserController.updateUserStatus);
router.delete('/:id', requireAuth(), requireAdmin, UserController.deleteUser);

export default router;
