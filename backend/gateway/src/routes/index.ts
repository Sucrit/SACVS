import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ENV } from '../config/env';
import { healthCheckRouter } from '../controller/health.check';

const router = Router();

// ── Gateway health check ─────────────────────────────────────
router.use('/health', healthCheckRouter);

// ── User service proxy ───────────────────────────────────────
router.use(
  '/users',
  createProxyMiddleware({
    target: ENV.USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: path => (path.startsWith('/users') ? path : `/users${path}`),
    on: {
      error: (err, _req, res: any) => {
        console.error('[PROXY] User service error:', err.message);
        if (!res.headersSent) {
          res.status(502).json({ error: 'User service unavailable' });
        }
      },
    },
  })
);

// ── Credential service proxy ─────────────────────────────────
router.use(
  '/credentials',
  createProxyMiddleware({
    target: ENV.CREDENTIALS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: path => (path.startsWith('/credentials') ? path : `/credentials${path}`),
    on: {
      error: (err, _req, res: any) => {
        console.error('[PROXY] Credential service error:', err.message);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Credential service unavailable' });
        }
      },
    },
  })
);

export default router;
