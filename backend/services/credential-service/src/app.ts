import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import credentialsRoutes from './routes/credentials.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(clerkMiddleware());

app.use('/', credentialsRoutes);
app.use(errorHandler);

export default app;
