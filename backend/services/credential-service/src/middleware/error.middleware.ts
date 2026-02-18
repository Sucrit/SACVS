import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status || err?.statusCode || 500;
  const message = err?.message || 'Internal Server Error';

  if (status >= 500) {
    console.error(`[ERROR] ${status} - ${message}`, err?.stack || '');
  } else {
    console.warn(`[WARN] ${status} - ${message}`);
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && err?.stack ? { stack: err.stack } : {}),
  });
};
