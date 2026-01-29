import express from 'express';
import cors from 'cors';
import routes from './routes';
import { ENV } from './config/env';

const app = express();

if (!ENV.CORS_ORIGIN) {
  app.use(cors());
} else {
  const allowed = ENV.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);
  const corsOptions = {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      // allow server-to-server requests (no origin) and matching origins
      if (!origin) return cb(null, true);
      if (allowed.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // cookies/credentials in the browser
  };
  app.use(cors(corsOptions));
}

app.use('/', routes);

export default app;
