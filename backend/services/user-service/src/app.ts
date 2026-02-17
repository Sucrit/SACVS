import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import userRoutes from './routes/user.routes';
import { errorHandler } from './middleware/error.middleware';
import { ENV } from './config/env';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware());

app.use('/', userRoutes);
app.use(errorHandler);

export default app;
