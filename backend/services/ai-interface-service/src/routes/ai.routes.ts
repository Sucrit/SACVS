import { Router } from 'express';
import { AnalysisController } from '../controller/analysis.controller';
import { healthCheck } from '../controller/health.controller';
import { requireInternalService } from '../middleware/internal.middleware';

const router = Router();
const controller = new AnalysisController();

router.get('/ai/health', healthCheck);
router.post('/ai/internal/analyze', requireInternalService, controller.queueAnalyze.bind(controller));
router.post('/ai/internal/results', requireInternalService, controller.applyInternalResult.bind(controller));

export default router;

