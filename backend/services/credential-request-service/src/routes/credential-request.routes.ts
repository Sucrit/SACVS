import express from 'express';
import { CredentialRequestController } from '../controller/credential-request.controller';
import { healthCheck } from '../controller/health.controller';
import {
  requireApprovedAccount,
  requireAuth,
  requireRoles,
} from '../middleware/auth.middleware';

const router = express.Router();
const credentialRequestController = new CredentialRequestController();

router.get('/health', healthCheck);

router.get(
  '/requests',
  requireAuth,
  requireApprovedAccount,
  credentialRequestController.listCredentialRequests.bind(credentialRequestController),
);

router.post(
  '/requests',
  requireAuth,
  requireApprovedAccount,
  requireRoles('STUDENT', 'INSTITUTION'),
  credentialRequestController.createCredentialRequest.bind(credentialRequestController),
);

router.get(
  '/requests/:id',
  requireAuth,
  requireApprovedAccount,
  credentialRequestController.getCredentialRequestById.bind(credentialRequestController),
);

router.patch(
  '/requests/:id/status',
  requireAuth,
  requireApprovedAccount,
  requireRoles('ADMIN', 'INSTITUTION', 'STUDENT'),
  credentialRequestController.updateCredentialRequestStatus.bind(credentialRequestController),
);

router.post(
  '/requests/:id/mark-physical-claimed',
  requireAuth,
  requireApprovedAccount,
  requireRoles('ADMIN', 'INSTITUTION'),
  credentialRequestController.markPhysicalClaimed.bind(credentialRequestController),
);

router.get(
  '/requests/:id/approval-receipt',
  requireAuth,
  requireApprovedAccount,
  requireRoles('STUDENT', 'INSTITUTION', 'ADMIN'),
  credentialRequestController.getApprovalReceipt.bind(credentialRequestController),
);

router.post(
  '/requests/verify-receipt',
  credentialRequestController.verifyApprovalReceipt.bind(credentialRequestController),
);

export default router;
