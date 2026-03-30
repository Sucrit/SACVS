import crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { PrismaClient, StepUpAction } from '../../../../db/node_modules/@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ENV } from '../config/env';
import { AuthenticatedRequest } from './auth.middleware';

const prismaAdapter = new PrismaPg({ connectionString: ENV.DATABASE_URL });
const prisma = new PrismaClient({ adapter: prismaAdapter });

const isEnforced = () => ENV.STEP_UP_ENFORCEMENT_MODE === 'enforce';

const hashValue = (raw: string): string => {
  const pepper = ENV.STEP_UP_TOKEN_PEPPER?.trim();
  if (!pepper) throw new Error('STEP_UP_TOKEN_INVALID');
  return crypto.createHash('sha256').update(`${raw}:${pepper}`).digest('hex');
};

const consumeSession = async (data: {
  tokenHash: string;
  userId: string;
  action: StepUpAction;
  targetId?: string | null;
  payloadHash?: string | null;
  now: Date;
}): Promise<'CONSUMED' | 'INVALID' | 'EXPIRED' | 'USED' | 'MISMATCH'> => {
  return prisma.$transaction(async tx => {
    const candidate = await tx.stepUpSession.findUnique({
      where: { tokenHash: data.tokenHash },
      select: {
        id: true,
        userId: true,
        action: true,
        targetId: true,
        payloadHash: true,
        expiresAt: true,
        usedAt: true,
        reusable: true,
      },
    });

    if (!candidate) return 'INVALID';
    if (candidate.usedAt && !candidate.reusable) return 'USED';
    if (candidate.expiresAt <= data.now) return 'EXPIRED';

    if (candidate.userId !== data.userId || candidate.action !== data.action) return 'MISMATCH';
    if (candidate.targetId && candidate.targetId !== (data.targetId ?? null)) return 'MISMATCH';
    if (candidate.payloadHash && candidate.payloadHash !== (data.payloadHash ?? null)) return 'MISMATCH';

    // Reusable sessions (e.g. CREDENTIAL_ISSUE) are validated but not consumed.
    if (candidate.reusable) {
      return 'CONSUMED';
    }

    const updated = await tx.stepUpSession.updateMany({
      where: {
        id: candidate.id,
        usedAt: null,
        expiresAt: { gt: data.now },
      },
      data: { usedAt: data.now },
    });

    if (updated.count !== 1) return 'USED';
    return 'CONSUMED';
  });
};

export const requireStepUp = (
  action: StepUpAction,
  targetIdResolver?: (req: Request) => string | null,
  payloadHashResolver?: (req: Request) => string | null,
) => async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  const actor = (req as AuthenticatedRequest).auth;
  const userId = actor?.sub;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const token = req.header('x-step-up-token')?.trim();
  if (!token) {
    if (isEnforced()) {
      return res.status(403).json({ error: 'STEP_UP_REQUIRED' });
    }
    return next();
  }

  let tokenHash: string;
  try {
    tokenHash = hashValue(token);
  } catch {
    if (isEnforced()) return res.status(403).json({ error: 'STEP_UP_TOKEN_INVALID' });
    return next();
  }

  const targetId = targetIdResolver ? targetIdResolver(req) : null;
  const payloadHash = payloadHashResolver ? payloadHashResolver(req) : null;
  const outcome = await consumeSession({
    tokenHash,
    userId,
    action,
    targetId,
    payloadHash,
    now: new Date(),
  });

  if (outcome === 'CONSUMED') return next();
  if (!isEnforced()) return next();

  const errorByOutcome: Record<string, string> = {
    INVALID: 'STEP_UP_TOKEN_INVALID',
    EXPIRED: 'STEP_UP_TOKEN_EXPIRED',
    USED: 'STEP_UP_TOKEN_INVALID',
    MISMATCH: 'STEP_UP_TOKEN_INVALID',
  };

  return res.status(403).json({ error: errorByOutcome[outcome] || 'STEP_UP_TOKEN_INVALID' });
};

export const requireStepUpIf = (
  predicate: (req: Request) => boolean,
  action: StepUpAction,
  targetIdResolver?: (req: Request) => string | null,
  payloadHashResolver?: (req: Request) => string | null,
) => async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  if (!predicate(req)) {
    return next();
  }
  return requireStepUp(action, targetIdResolver, payloadHashResolver)(req, res, next);
};
