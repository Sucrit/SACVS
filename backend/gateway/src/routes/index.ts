import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ENV } from '../config/env';
import { healthCheckRouter } from '../controller/health.check';

const router = Router();
router.use(healthCheckRouter);

// Proxy credentials service first so specific routes match before the catch-all
if (ENV.CREDENTIALS_SERVICE_URL) {
  router.use(
    '/credentials',
    createProxyMiddleware({
      target: ENV.CREDENTIALS_SERVICE_URL,
      changeOrigin: true,
    })
  );
}

// Fallback proxy to user service for other API routes
router.use(
  '/',
  createProxyMiddleware({
    target: ENV.USER_SERVICE_URL,
    changeOrigin: true,
  })
);

export default router;
