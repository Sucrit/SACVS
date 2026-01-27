import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ENV } from '../config/env';
import { healthCheckRouter } from '../controller/health.check';

const router = Router();
router.use(healthCheckRouter);

router.use(
  '/',
  createProxyMiddleware({
    target: ENV.USER_SERVICE_URL,
    changeOrigin: true,
  })
);

export default router;
