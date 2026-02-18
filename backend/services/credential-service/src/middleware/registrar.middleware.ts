import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../db/prisma';

type AuthenticatedRequest = Request & {
  auth?: {
    userId?: string;
  };
  user?: {
    id: string;
    role: Role;
    clerkId: string;
  };
};

/**
 * Middleware that resolves the Clerk userId to a DB user and attaches it to req.user.
 * Does NOT enforce any role — just populates the user context.
 */
export async function resolveUser(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const clerkId = req.auth?.userId;
  if (!clerkId) {
    return next({ status: 401, message: 'Unauthorized' });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true, clerkId: true, status: true },
  });

  if (!user) {
    return next({ status: 404, message: 'User not found in system' });
  }

  if (user.status !== 'APPROVED') {
    return next({ status: 403, message: 'Account not approved' });
  }

  req.user = { id: user.id, role: user.role, clerkId: user.clerkId };
  return next();
}

/**
 * Requires the resolved user to be a REGISTRAR or ADMIN.
 */
export async function requireRegistrar(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next({ status: 401, message: 'Unauthorized' });
  }

  if (req.user.role !== Role.REGISTRAR && req.user.role !== Role.ADMIN) {
    return next({ status: 403, message: 'Only registrars or admins can perform this action.' });
  }

  return next();
}

/**
 * Requires the resolved user to be an ADMIN.
 */
export async function requireAdmin(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next({ status: 401, message: 'Unauthorized' });
  }

  if (req.user.role !== Role.ADMIN) {
    return next({ status: 403, message: 'Admin access required.' });
  }

  return next();
}

/**
 * Requires the resolved user to be a STUDENT.
 */
export async function requireStudent(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next({ status: 401, message: 'Unauthorized' });
  }

  if (req.user.role !== Role.STUDENT) {
    return next({ status: 403, message: 'Student access required.' });
  }

  return next();
}
