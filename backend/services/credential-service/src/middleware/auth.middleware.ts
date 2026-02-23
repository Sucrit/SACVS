import { getAuth } from '@clerk/express';
import { NextFunction, Request, Response } from 'express';
import { PrismaClient, Role, Status } from '../../../../db/node_modules/@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ENV } from '../config/env';

type UserRole = `${Role}`;
type UserStatus = `${Status}`;

export interface AuthenticatedRequest extends Request {
  auth?: {
    sub: string;
    role?: UserRole;
    status?: UserStatus;
    institutionId?: string | null;
    employerId?: string | null;
  };
}

if (!ENV.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured for credential-service.');
}

const prismaAdapter = new PrismaPg({ connectionString: ENV.DATABASE_URL });
const prisma = new PrismaClient({ adapter: prismaAdapter });

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

    const localUser = await prisma.user.findUnique({
      where: { id: clerkAuth.userId },
      select: {
        role: true,
        status: true,
        institutionId: true,
        employerId: true,
      },
    });

    (req as AuthenticatedRequest).auth = {
      sub: clerkAuth.userId,
      role: localUser?.role as UserRole | undefined,
      status: localUser?.status as UserStatus | undefined,
      institutionId: localUser?.institutionId,
      employerId: localUser?.employerId,
    };

    return next();
  } catch (error) {
    console.error('Credential auth middleware failed:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

export const requireRoles =
  (...allowedRoles: UserRole[]) =>
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
