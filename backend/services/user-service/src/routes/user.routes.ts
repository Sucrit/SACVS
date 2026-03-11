import express from 'express';
import { UserController } from '../controller/user.controller';
import { requireApprovedAccount, requireAuth, requireRoles } from '../middleware/auth.middleware';
import { requireStepUp } from '../middleware/stepup.middleware';

const router = express.Router();
const userController = new UserController();

router.get('/me', requireAuth, userController.getCurrentUser.bind(userController));
router.post('/me/onboarding', requireAuth, userController.completeOrganizationOnboarding.bind(userController));
router.put('/me/onboarding', requireAuth, userController.completeOrganizationOnboarding.bind(userController));
router.put('/me/profile', requireAuth, userController.upsertMyProfile.bind(userController));
router.post(
  '/me/step-up/challenges',
  requireAuth,
  requireApprovedAccount,
  userController.createStepUpChallenge.bind(userController),
);
router.post(
  '/me/step-up/challenges/:challengeId/verify',
  requireAuth,
  requireApprovedAccount,
  userController.verifyStepUpChallenge.bind(userController),
);
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
  requireStepUp('BULK_STUDENT_CREATE'),
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
  requireRoles('ADMIN', 'INSTITUTION'),
  userController.listAuditLogs.bind(userController),
);

router.get(
  '/',
  requireAuth,
  requireRoles('ADMIN'),
  userController.listUsers.bind(userController),
);
router.get(
  '/summary',
  requireAuth,
  requireRoles('ADMIN'),
  userController.getAdminOverviewSummary.bind(userController),
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
  requireStepUp('STATUS_CHANGE', req => (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id)),
  userController.updateUserStatus.bind(userController),
);
router.put(
  '/:id/role',
  requireAuth,
  requireRoles('ADMIN'),
  requireStepUp('ROLE_CHANGE', req => (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id)),
  userController.updateUserRole.bind(userController),
);

export default router;
