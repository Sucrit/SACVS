import express from 'express';
import credentialsRoutes from './routes/credentials.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', credentialsRoutes);
app.use(errorHandler);

export default app;
