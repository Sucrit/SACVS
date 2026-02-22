import { Request, Response } from 'express';

export const healthCheck = (_req: Request, res: Response): Response =>
  res.status(200).json({
    status: 'ok',
    service: 'credential-request-service',
  });
