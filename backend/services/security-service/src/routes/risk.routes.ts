import { Router } from 'express';
import { Role } from '../../../../db/node_modules/@prisma/client';
import { RiskController } from '../controller/risk.controller';
import { requireApprovedAccount, requireAuth, requireRoles } from '../middleware/auth.middleware';

const router = Router();
const controller = new RiskController();

router.use(requireAuth, requireApprovedAccount, requireRoles(Role.ADMIN));

router.get('/risk-events', (req, res) => void controller.listRiskEvents(req, res));
router.put('/risk-events/:id/review', (req, res) => void controller.updateRiskReviewStatus(req, res));

export default router;
