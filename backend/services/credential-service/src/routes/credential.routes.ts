import express from 'express';
import { CredentialController } from '../controller/credential.controller';
import { healthCheck } from '../controller/health.controller';
import { requireApprovedAccount, requireAuth, requireRoles } from '../middleware/auth.middleware';
import { requireInternalService } from '../middleware/internal.middleware';
import { credentialUpload } from '../middleware/upload.middleware';

const router = express.Router();
const credentialController = new CredentialController();

router.get('/health' , healthCheck);
router.get(
  '/internal/documents/:id',
  requireInternalService,
  credentialController.getInternalCredentialDocument.bind(credentialController),
);
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
router.get(
  '/:id/document',
  requireAuth,
  requireApprovedAccount,
  credentialController.getCredentialDocument.bind(credentialController),
);
router.post(
  '/verify/qr',
  credentialController.verifyCredentialQrPublic.bind(credentialController),
);
router.post(
  '/verify/qr/employer',
  requireAuth,
  requireApprovedAccount,
  requireRoles('EMPLOYER'),
  credentialController.verifyCredentialQrEmployer.bind(credentialController),
);
router.get(
  '/verify/qr/document/:token',
  credentialController.getCredentialDocumentByQrToken.bind(credentialController),
);
router.post(
  '/:id/qr-token',
  requireAuth,
  requireApprovedAccount,
  requireRoles('STUDENT'),
  credentialController.generateCredentialQrToken.bind(credentialController),
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
