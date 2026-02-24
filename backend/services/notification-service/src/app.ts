import { clerkMiddleware } from '@clerk/express';
import express from 'express';
import notificationRoutes from './routes/notification.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware());

app.use('/', notificationRoutes);

app.use(errorHandler);

export default app;
