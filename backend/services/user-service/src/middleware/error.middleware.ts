import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(err);
  }

  const isObject = err !== null && typeof err === 'object';
  const type = isObject ? (err as Record<string, unknown>).type : undefined;
  const code = isObject ? (err as Record<string, unknown>).code : undefined;

  if (type === 'request.aborted' || code === 'ECONNABORTED') {
    // Client closed connection while request body was being read.
    return res.status(499).json({ error: 'Client closed request' });
  }

  console.error(err);

  const name = isObject ? (err as Record<string, unknown>).name : undefined;
  const message = isObject ? (err as Record<string, unknown>).message : undefined;

  if (name === 'ValidationError') {
    return res.status(400).json({ error: message });
  }

  return res.status(500).json({ error: 'Internal Server Error' });
}
