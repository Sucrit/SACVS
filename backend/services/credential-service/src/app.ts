import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import credentialRoutes from './routes/credential.routes';
import { errorHandler } from './middleware/error.middleware';
import { CREDENTIAL_UPLOADS_DIR, ensureCredentialUploadsDir } from './config/uploads';
import { CredentialRepository } from './repository/credential.repository';

const app = express();
app.disable('x-powered-by');
const credentialRepository = new CredentialRepository();

ensureCredentialUploadsDir();

app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware());
app.use('/credentials/uploads', async (req, res, next) => {
  try {
    const normalizedPath = req.path.startsWith('/') ? req.path : `/${req.path}`;
    const decodedPath = decodeURIComponent(normalizedPath);
    const requestedStorageKey = `/credentials/uploads${decodedPath}`;

    const isRevoked = await credentialRepository.isStorageKeyRevoked(requestedStorageKey);
    if (isRevoked) {
      return res.status(403).json({
        error: 'Credential file has been revoked and is no longer accessible.',
      });
    }
    return next();
  } catch (error) {
    return next(error);
  }
});
app.use('/credentials/uploads', express.static(CREDENTIAL_UPLOADS_DIR));

app.use('/credentials', credentialRoutes);

app.use(errorHandler);

export default app;
