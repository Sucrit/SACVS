import express from 'express';
import { CredentialController } from '../controller/credential.controller';
import { healthCheck } from '../controller/health.controller';
import { requireApprovedAccount, requireAuth, requireRoles } from '../middleware/auth.middleware';
import { credentialUpload } from '../middleware/upload.middleware';

const router = express.Router();
const credentialController = new CredentialController();

router.get('/health' , healthCheck);
router.get(
  '/',
  requireAuth,
  requireApprovedAccount,
  credentialController.listCredentials.bind(credentialController),
);
router.post(
  '/',
  requireAuth,
  requireApprovedAccount,
  requireRoles('ADMIN', 'INSTITUTION'),
  credentialUpload.single('file'),
  credentialController.createCredential.bind(credentialController),
);
router.get('/:id', requireAuth, requireApprovedAccount, credentialController.getCredentialById.bind(credentialController));
router.put(
  '/:id/status',
  requireAuth,
  requireApprovedAccount,
  requireRoles('ADMIN', 'INSTITUTION'),
  credentialController.updateCredentialStatus.bind(credentialController),
);
router.put(
  '/:id/issue',
  requireAuth,
  requireApprovedAccount,
  requireRoles('ADMIN', 'INSTITUTION'),
  credentialUpload.single('file'),
  credentialController.issueCredential.bind(credentialController),
);

export default router;
