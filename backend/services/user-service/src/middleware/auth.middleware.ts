import { NextFunction, Request, Response } from 'express';
import { AccessTokenPayload, verifyAccessToken } from '../utils/token';
import { UserRole } from '../dto/user.dto';

export interface AuthenticatedRequest extends Request {
  auth?: AccessTokenPayload;
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): Response | void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = verifyAccessToken(token);
    (req as AuthenticatedRequest).auth = decoded;
    return next();
  } catch (error) {
    console.error('Auth verification failed:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRoles =
  (...allowedRoles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction): Response | void => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(auth.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return next();
  };

export const requireApprovedAccount = (req: Request, res: Response, next: NextFunction): Response | void => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (auth.status !== 'APPROVED') {
    return res.status(403).json({ error: 'Account is not approved for this action.' });
  }

  return next();
};
