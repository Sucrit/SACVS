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
// admin-only management
router.get('/', requireAnyClerkAuth, requireAdmin, UserController.getUsers);
router.post('/admin/users', requireAnyClerkAuth, requireAdmin, UserController.adminCreateUser);
router.patch('/admin/users/:id/status', requireAnyClerkAuth, requireAdmin, UserController.updateUserStatus);
router.delete('/:id', requireAnyClerkAuth, requireAdmin, UserController.deleteUser);

export default router;
