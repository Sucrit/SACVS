import crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { StepUpAction } from '../../../../db/node_modules/@prisma/client';
import { ENV } from '../config/env';
import { AuthenticatedRequest } from './auth.middleware';
import { UserRepository } from '../repository/user.repository';

const userRepository = new UserRepository();

const isEnforced = () => ENV.STEP_UP_ENFORCEMENT_MODE === 'enforce';

const hashValue = (raw: string): string => {
  const pepper = ENV.STEP_UP_TOKEN_PEPPER?.trim();
  if (!pepper) {
    throw new Error('STEP_UP_TOKEN_INVALID');
  }
  return crypto.createHash('sha256').update(`${raw}:${pepper}`).digest('hex');
};

export const requireStepUp = (
  action: StepUpAction,
  targetIdResolver?: (req: Request) => string | null,
  payloadHashResolver?: (req: Request) => string | null,
) => async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  const actor = (req as AuthenticatedRequest).auth;
  const userId = actor?.sub;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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
    if (isEnforced()) {
      return res.status(403).json({ error: 'STEP_UP_TOKEN_INVALID' });
    }
    return next();
  }

  const targetId = targetIdResolver ? targetIdResolver(req) : null;
  const payloadHash = payloadHashResolver ? payloadHashResolver(req) : null;
  const result = await userRepository.consumeStepUpSessionAtomically({
    tokenHash,
    userId,
    action,
    targetId,
    payloadHash,
    now: new Date(),
  });

  if (result === 'CONSUMED') {
    return next();
  }

  if (!isEnforced()) {
    return next();
  }

  const errorByOutcome: Record<string, string> = {
    INVALID: 'STEP_UP_TOKEN_INVALID',
    EXPIRED: 'STEP_UP_TOKEN_EXPIRED',
    USED: 'STEP_UP_TOKEN_INVALID',
    MISMATCH: 'STEP_UP_TOKEN_INVALID',
  };

  return res.status(403).json({ error: errorByOutcome[result] || 'STEP_UP_TOKEN_INVALID' });
};
