import { verifyToken } from '@clerk/backend';
import { NextFunction, Request, Response } from 'express';
import { ENV } from '../config/env';

type AuthenticatedRequest = Request & {
  auth?: {
    userId?: string;
    isAdminAuth?: boolean;
  };
};

const CLERK_KEY_SET = [
  { secret: ENV.CLERK_SECRET_KEY, isAdminAuth: false },
  { secret: ENV.CLERK_ADMIN_SECRET_KEY, isAdminAuth: true },
].filter(
  (value): value is { secret: string; isAdminAuth: boolean } =>
    typeof value.secret === 'string' && value.secret.trim().length > 0
);

function getBearerToken(req: Request): string | null {
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader || typeof authorizationHeader !== 'string') return null;
  if (!authorizationHeader.toLowerCase().startsWith('bearer ')) return null;
  const token = authorizationHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function requireAnyClerkAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) return next({ status: 401, message: 'Unauthorized' });
  if (CLERK_KEY_SET.length === 0) {
    return next({ status: 500, message: 'No Clerk secret keys configured.' });
  }

  for (const keySet of CLERK_KEY_SET) {
    try {
      const payload = await verifyToken(token, { secretKey: keySet.secret });
      if (payload?.sub) {
        req.auth = { userId: String(payload.sub), isAdminAuth: keySet.isAdminAuth };
        return next();
      }
    } catch {
      // try next secret
    }
  }

  return next({ status: 401, message: 'Unauthorized' });
}
