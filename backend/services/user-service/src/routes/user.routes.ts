import express from 'express';
import { UserController } from '../controller/user.controller';
import { requireAuth, requireRoles } from '../middleware/auth.middleware';

const router = express.Router();
const userController = new UserController();

router.post('/auth/register', userController.register.bind(userController));
router.post('/auth/login', userController.login.bind(userController));
router.post('/auth/verify-otp', userController.verifyOtp.bind(userController));

router.get('/me', requireAuth, userController.getCurrentUser.bind(userController));
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
