import { Router } from 'express';
const router = Router();

router.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'api gateway' });
});

export { router as healthCheckRouter };