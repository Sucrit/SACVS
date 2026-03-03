import { Request, Response } from 'express';
import { ENV } from '../config/env';

export const healthCheck = (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    service: 'credential service',
    internalAuthConfigured: Boolean(ENV.INTERNAL_SERVICE_TOKEN?.trim()),
  });
};
