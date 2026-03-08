import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import riskRoutes from './routes/risk.routes';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware());

app.use('/security', riskRoutes);

export default app;
