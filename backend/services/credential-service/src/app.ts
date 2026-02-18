import express from 'express';
import credentialRoutes from './routes/credential.routes';
import { errorHandler } from './middleware/error.middleware';
import { clerkMiddleware } from '@clerk/express'; 

const app = express();

app.use(clerkMiddleware());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/credentials', credentialRoutes);

app.use(errorHandler);

export default app;
