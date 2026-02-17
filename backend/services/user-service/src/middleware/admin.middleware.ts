import { NextFunction, Request, Response } from 'express';
import { Role, Status } from '@prisma/client';
import { prisma } from '../db/prisma';

type AuthenticatedRequest = Request & {
  auth?: {
    userId?: string;
  };
};

export async function requireAdmin(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const clerkId = req.auth?.userId;
  if (!clerkId) {
    return next({ status: 401, message: 'Unauthorized' });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { role: true, status: true },
  });

  if (!user || user.role !== Role.ADMIN || user.status !== Status.APPROVED) {
    return next({ status: 403, message: 'Admin privileges required.' });
  }

  return next();
}
