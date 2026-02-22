import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ENV } from '../config/env';
import { healthCheckRouter } from '../controller/health.check';

const router = Router();

router.use('/health', healthCheckRouter);

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
  }),
);

router.use(
  '/credentials/requests',
  createProxyMiddleware({
    target: ENV.CREDENTIAL_REQUEST_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: path => {
      if (!path || path === '/') {
        return '/requests';
      }
      if (path.startsWith('/credentials/requests')) {
        return path.replace(/^\/credentials\/requests/, '/requests');
      }
      return `/requests${path}`;
    },
    on: {
      error: (err, _req, res: any) => {
        console.error('[PROXY] Credential request service error:', err.message);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Credential request service unavailable' });
        }
      },
    },
  }),
);

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
  }),
);

export default router;
