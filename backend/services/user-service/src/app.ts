import express from 'express';
import userRoutes from './routes/user.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

app.use(express.json());

app.use('/', userRoutes);

app.use(errorHandler);

export default app;
