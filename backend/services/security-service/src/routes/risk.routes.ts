import { Router } from 'express';
import { Role } from '../../../../db/node_modules/@prisma/client';
import { RiskController } from '../controller/risk.controller';
import { requireApprovedAccount, requireAuth, requireRoles } from '../middleware/auth.middleware';

const router = Router();
const controller = new RiskController();

router.use(requireAuth, requireApprovedAccount, requireRoles(Role.ADMIN));

router.get('/risk-worker/status', (req, res) => void controller.getWorkerStatus(req, res));
router.get('/risk-events', (req, res) => void controller.listRiskEvents(req, res));
router.get('/risk-events/export', (req, res) => void controller.exportReviewedRiskEvents(req, res));
router.get('/risk-events/:id', (req, res) => void controller.getRiskEventDetails(req, res));
router.post('/risk-events/:id/readable-report', (req, res) =>
  void controller.regenerateReadableReport(req, res),
);
router.put('/risk-events/:id/review', (req, res) => void controller.updateRiskReviewStatus(req, res));

export default router;
