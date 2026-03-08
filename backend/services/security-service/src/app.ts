import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import { ENV } from './config/env';
import riskRoutes from './routes/risk.routes';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  clerkMiddleware({
    publishableKey: ENV.CLERK_PUBLISHABLE_KEY,
    secretKey: ENV.CLERK_SECRET_KEY,
  }),
);

app.use('/security', riskRoutes);

export default app;
