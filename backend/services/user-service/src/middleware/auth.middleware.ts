import { getAuth } from '@clerk/express';
import { NextFunction, Request, Response } from 'express';
import { UserRole, UserStatus } from '../dto/user.dto';
import { UserRepository } from '../repository/user.repository';

export interface AuthenticatedRequest extends Request {
  auth?: {
    sub: string;
    email?: string | null;
    role?: UserRole;
    status?: UserStatus;
  };
}

const userRepository = new UserRepository();

const extractEmailFromSessionClaims = (claims: Record<string, unknown>): string | null => {
  const direct =
    typeof claims.email === 'string'
      ? claims.email
      : typeof claims.email_address === 'string'
        ? claims.email_address
        : null;
  if (direct && direct.trim().length > 0) {
    return direct.trim();
  }

  const primaryEmailId =
    typeof claims.primary_email_address_id === 'string' ? claims.primary_email_address_id : null;
  const emailAddresses = Array.isArray(claims.email_addresses)
    ? (claims.email_addresses as Array<Record<string, unknown>>)
    : [];

  if (primaryEmailId) {
    const primary = emailAddresses.find(address => address?.id === primaryEmailId);
    const primaryValue =
      typeof primary?.email_address === 'string'
        ? primary.email_address
        : typeof primary?.email === 'string'
          ? primary.email
          : null;
    if (primaryValue && primaryValue.trim().length > 0) {
      return primaryValue.trim();
    }
  }

  const first = emailAddresses.find(address =>
    typeof address?.email_address === 'string' || typeof address?.email === 'string',
  );
  const firstValue =
    typeof first?.email_address === 'string'
      ? first.email_address
      : typeof first?.email === 'string'
        ? first.email
        : null;
  if (firstValue && firstValue.trim().length > 0) {
    return firstValue.trim();
  }

  return null;
};

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
    const sessionClaims = (clerkAuth.sessionClaims ?? {}) as Record<string, unknown>;
    const emailFromClaims = extractEmailFromSessionClaims(sessionClaims);

    const localUser = await userRepository.getUserById(clerkAuth.userId);
    (req as AuthenticatedRequest).auth = {
      sub: clerkAuth.userId,
      email: emailFromClaims,
      role: localUser?.role as UserRole | undefined,
      status: localUser?.status as UserStatus | undefined,
    };

    return next();
  } catch (error) {
    console.error('Clerk auth middleware failed:', error);
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
