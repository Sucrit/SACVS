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
  '/ai/queue',
  requireAuth,
  requireApprovedAccount,
  requireRoles('ADMIN', 'INSTITUTION'),
  credentialController.listAiQueue.bind(credentialController),
);
router.post(
  '/internal/ai-results',
  requireInternalService,
  credentialController.applyInternalAiResult.bind(credentialController),
);
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
  '/:id/ai-report',
  requireAuth,
  requireApprovedAccount,
  requireRoles('ADMIN', 'INSTITUTION'),
  credentialController.getCredentialAiReport.bind(credentialController),
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
router.post(
  '/:id/qr-token',
  requireAuth,
  requireApprovedAccount,
  requireRoles('STUDENT'),
  credentialController.generateCredentialQrToken.bind(credentialController),
);
router.post(
  '/:id/ai-review',
  requireAuth,
  requireApprovedAccount,
  requireRoles('ADMIN', 'INSTITUTION'),
  credentialController.reviewCredentialAi.bind(credentialController),
);
router.post(
  '/:id/ai-reanalyze',
  requireAuth,
  requireApprovedAccount,
  requireRoles('ADMIN', 'INSTITUTION'),
  credentialController.queueCredentialAiReanalyze.bind(credentialController),
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
