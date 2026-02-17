import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ENV } from '../config/env';
import { healthCheckRouter } from '../controller/health.check';

const router = Router();

// gatewway health check
router.use('/health', healthCheckRouter);

// User service proxy
router.use(
  '/users',
  createProxyMiddleware({
    target: ENV.USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/users': '',
    },
  })
);

// Credential service proxy
router.use(
  '/credentials',
  createProxyMiddleware({
    target: ENV.CREDENTIALS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/credentials': '',
    },
  })
);

export default router;
