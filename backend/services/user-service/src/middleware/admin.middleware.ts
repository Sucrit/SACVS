import { NextFunction, Request, Response } from 'express';

type AuthenticatedRequest = Request & {
  auth?: {
    userId?: string;
    isAdminAuth?: boolean;
  };
};

export async function requireAdmin(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  if (!req.auth?.userId) {
    return next({ status: 401, message: 'Unauthorized' });
  }

  if (!req.auth?.isAdminAuth) {
    return next({ status: 403, message: 'Admin privileges required.' });
  }

  return next();
}
