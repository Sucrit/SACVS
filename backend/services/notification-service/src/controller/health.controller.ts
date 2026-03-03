import { Request, Response } from 'express';
import { ENV } from '../config/env';

export const healthCheck = (_req: Request, res: Response): Response =>
  res.status(200).json({
    status: 'ok',
    service: 'notification-service',
    internalAuthConfigured: Boolean(ENV.INTERNAL_SERVICE_TOKEN?.trim()),
  });
