import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import credentialRoutes from './routes/credential.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware());

app.use('/credentials', credentialRoutes);

app.use(errorHandler);

export default app;
