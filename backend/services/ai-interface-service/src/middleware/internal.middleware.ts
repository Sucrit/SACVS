import { NextFunction, Request, Response } from 'express';
import { ENV } from '../config/env';

export const requireInternalService = (
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void => {
  const configuredToken = ENV.INTERNAL_SERVICE_TOKEN?.trim();
  if (!configuredToken) {
    return next();
  }

  const incomingToken = req.header('x-internal-service-token');
  if (!incomingToken || incomingToken !== configuredToken) {
    return res.status(401).json({ error: 'Unauthorized internal request.' });
  }

  return next();
};

