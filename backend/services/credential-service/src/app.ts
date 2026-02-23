import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import credentialRoutes from './routes/credential.routes';
import { errorHandler } from './middleware/error.middleware';
import { CREDENTIAL_UPLOADS_DIR, ensureCredentialUploadsDir } from './config/uploads';

const app = express();

ensureCredentialUploadsDir();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware());
app.use('/credentials/uploads', express.static(CREDENTIAL_UPLOADS_DIR));

app.use('/credentials', credentialRoutes);

app.use(errorHandler);

export default app;
