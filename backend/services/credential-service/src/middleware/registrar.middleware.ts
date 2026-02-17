import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../db/prisma';

type AuthenticatedRequest = Request & {
  auth?: {
    userId?: string;
  };
};

export async function requireRegistrar(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const clerkId = req.auth?.userId;
  if (!clerkId) {
    return next({ status: 401, message: 'Unauthorized' });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { role: true },
  });

  if (!user || user.role !== Role.REGISTRAR) {
    return next({ status: 403, message: 'Only registrars can issue credentials.' });
  }

  return next();
}
