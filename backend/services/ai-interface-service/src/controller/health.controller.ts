import { Request, Response } from 'express';
import { ENV } from '../config/env';

export const healthCheck = (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    service: 'ai-interface-service',
    provider: ENV.AI_PROVIDER,
  });
};

