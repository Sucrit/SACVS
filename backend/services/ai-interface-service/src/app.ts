import express from 'express';
import routes from './routes/ai.routes';

const app = express();

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/', routes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('AI interface service error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;

