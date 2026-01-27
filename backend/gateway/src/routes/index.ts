import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ENV } from '../config/env';

const router = Router();

router.use(
  '/users',
  createProxyMiddleware({
    target: ENV.USER_SERVICE_URL,
    changeOrigin: true,
  })
);

export default router;
