import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import credentialsRoutes from './routes/credentials.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

// Body parsing
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Clerk middleware (populates req.auth but does NOT enforce auth globally)
app.use(clerkMiddleware());

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/', credentialsRoutes);

// Error handling
app.use(errorHandler);

export default app;
