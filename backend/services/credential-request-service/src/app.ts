import { clerkMiddleware } from '@clerk/express';
import express from 'express';
import credentialRequestRoutes from './routes/credential-request.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware());

app.use('/', credentialRequestRoutes);

app.use(errorHandler);

export default app;
