import { getAuth } from '@clerk/express';
import { NextFunction, Request, Response } from 'express';
import { Role } from '../../../../db/node_modules/@prisma/client';
import { RiskRepository } from '../repository/risk.repository';

export interface AuthenticatedRequest extends Request {
  auth?: {
    sub: string;
    role?: Role;
    status?: string;
  };
}

const repository = new RiskRepository();

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  try {
    const clerkAuth = getAuth(req);
    if (!clerkAuth.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const localUser = await repository.getUserAuthContext(clerkAuth.userId);
    (req as AuthenticatedRequest).auth = {
      sub: clerkAuth.userId,
      role: localUser?.role,
      status: localUser?.status,
    };

    return next();
  } catch (error) {
    console.error('[security-service] Auth middleware failed:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

export const requireRoles =
  (...allowedRoles: Role[]) =>
  (req: Request, res: Response, next: NextFunction): Response | void => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth?.sub) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!auth.role || !allowedRoles.includes(auth.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return next();
  };

export const requireApprovedAccount = (
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (auth.status !== 'APPROVED') {
    return res.status(403).json({ error: 'Account is not approved for this action.' });
  }

  return next();
};
