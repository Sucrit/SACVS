import express from 'express';
import cors from 'cors';
import routes from './routes';
import { ENV } from './config/env';

const app = express();

app.use(cors({ origin: ENV.CORS_ORIGIN }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', routes);

export default app;
