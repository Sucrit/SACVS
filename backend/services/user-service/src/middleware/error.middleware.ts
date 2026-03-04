import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(err);
  }

  if (err?.type === 'request.aborted' || err?.code === 'ECONNABORTED') {
    // Client closed connection while request body was being read.
    return res.status(499).json({ error: 'Client closed request' });
  }

  console.error(err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  return res.status(500).json({ error: 'Internal Server Error' });
}
