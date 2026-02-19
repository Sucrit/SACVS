import express from 'express';
import { UserController } from '../controller/user.controller';
import { requireAuth, requireRoles } from '../middleware/auth.middleware';

const router = express.Router();
const userController = new UserController();

router.get('/me', requireAuth, userController.getCurrentUser.bind(userController));
router.post('/me/onboarding', requireAuth, userController.completeStudentOnboarding.bind(userController));
router.put('/me/profile', requireAuth, userController.upsertMyProfile.bind(userController));

router.get(
  '/',
  requireAuth,
  requireRoles('ADMIN', 'REGISTRAR'),
  userController.listUsers.bind(userController),
);
router.post(
  '/',
  requireAuth,
  requireRoles('ADMIN'),
  userController.createUser.bind(userController),
);
router.get(
  '/:id',
  requireAuth,
  requireRoles('ADMIN', 'REGISTRAR'),
  userController.getUserById.bind(userController),
);
router.put(
  '/:id/status',
  requireAuth,
  requireRoles('ADMIN', 'REGISTRAR'),
  userController.updateUserStatus.bind(userController),
);

export default router;
