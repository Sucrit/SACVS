import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { UserRole, UserStatus } from '../dto/user.dto';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  type: 'access';
}

const ACCESS_TOKEN_EXPIRY = '12h';

export const signAccessToken = (payload: Omit<AccessTokenPayload, 'type'>): string => {
  const secret = ENV.JWT_SECRET || 'dev-legacy-auth-secret';

  return jwt.sign(
    {
      ...payload,
      type: 'access',
    } satisfies AccessTokenPayload,
    secret,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const secret = ENV.JWT_SECRET || 'dev-legacy-auth-secret';
  const decoded = jwt.verify(token, secret) as AccessTokenPayload;

  if (decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }

  return decoded;
};
