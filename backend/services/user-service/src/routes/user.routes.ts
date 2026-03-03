import express from 'express';
import { UserController } from '../controller/user.controller';
import { requireApprovedAccount, requireAuth, requireRoles } from '../middleware/auth.middleware';

const router = express.Router();
const userController = new UserController();

router.get('/me', requireAuth, userController.getCurrentUser.bind(userController));
router.post('/me/onboarding', requireAuth, userController.completeOrganizationOnboarding.bind(userController));
router.put('/me/onboarding', requireAuth, userController.completeOrganizationOnboarding.bind(userController));
router.put('/me/profile', requireAuth, userController.upsertMyProfile.bind(userController));
router.get(
  '/me/institution/students',
  requireAuth,
  requireRoles('INSTITUTION'),
  userController.listMyInstitutionStudents.bind(userController),
);
router.post(
  '/me/institution/students',
  requireAuth,
  requireRoles('INSTITUTION'),
  userController.createInstitutionStudent.bind(userController),
);
router.post(
  '/me/institution/students/bulk',
  requireAuth,
  requireRoles('INSTITUTION'),
  userController.createInstitutionStudentsBulk.bind(userController),
);
router.put(
  '/me/institution/students/:id',
  requireAuth,
  requireRoles('INSTITUTION'),
  userController.updateInstitutionStudent.bind(userController),
);
router.delete(
  '/me/institution/students/:id',
  requireAuth,
  requireRoles('INSTITUTION'),
  userController.deleteInstitutionStudent.bind(userController),
);
router.put(
  '/me/institution/students/:id/status',
  requireAuth,
  requireRoles('INSTITUTION'),
  userController.updateInstitutionStudentStatus.bind(userController),
);
router.get(
  '/audit',
  requireAuth,
  requireApprovedAccount,
  requireRoles('ADMIN', 'INSTITUTION', 'EMPLOYER'),
  userController.listAuditLogs.bind(userController),
);

router.get(
  '/',
  requireAuth,
  requireRoles('ADMIN'),
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
  requireRoles('ADMIN'),
  userController.getUserById.bind(userController),
);
router.put(
  '/:id/status',
  requireAuth,
  requireRoles('ADMIN'),
  userController.updateUserStatus.bind(userController),
);
router.put(
  '/:id/role',
  requireAuth,
  requireRoles('ADMIN'),
  userController.updateUserRole.bind(userController),
);

export default router;
