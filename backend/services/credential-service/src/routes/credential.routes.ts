import express from 'express';
import { CredentialController } from '../controller/credential.controller';
import { healthCheck } from '../controller/health.controller';
import { requireApprovedAccount, requireAuth, requireRoles } from '../middleware/auth.middleware';

const router = express.Router();
const credentialController = new CredentialController();

router.get('/health' , healthCheck);
router.post(
  '/',
  requireAuth,
  requireApprovedAccount,
  requireRoles('ADMIN', 'REGISTRAR'),
  credentialController.createCredential.bind(credentialController),
);
router.get('/:id', requireAuth, requireApprovedAccount, credentialController.getCredentialById.bind(credentialController));
router.put(
  '/:id/status',
  requireAuth,
  requireApprovedAccount,
  requireRoles('ADMIN', 'REGISTRAR'),
  credentialController.updateCredentialStatus.bind(credentialController),
);

export default router;
