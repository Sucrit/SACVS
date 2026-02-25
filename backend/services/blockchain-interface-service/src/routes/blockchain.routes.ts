import { Router } from 'express';
import { BlockchainController } from '../controller/blockchain.controller';
import { healthCheck } from '../controller/health.controller';
import { requireInternalService } from '../middleware/internal.middleware';

const router = Router();
const controller = new BlockchainController();

router.get('/health', healthCheck);
router.get('/blockchain/credentials/:id/verify', controller.verifyCredential.bind(controller));
router.get(
  '/blockchain/credentials/:id/verify-document',
  controller.verifyCredentialDocument.bind(controller),
);
router.post(
  '/blockchain/credentials/anchor',
  requireInternalService,
  controller.anchorCredential.bind(controller),
);
router.post(
  '/blockchain/credentials/revoke',
  requireInternalService,
  controller.revokeCredential.bind(controller),
);

export default router;
