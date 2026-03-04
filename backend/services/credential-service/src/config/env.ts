import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (typeof value !== 'string') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const ENV = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    PRISMA_SCHEMA_PATH: process.env.PRISMA_SCHEMA_PATH,
    CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5300',
    BLOCKCHAIN_INTERFACE_SERVICE_URL:
      process.env.BLOCKCHAIN_INTERFACE_SERVICE_URL || 'http://localhost:5400',
    INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN,
    STEP_UP_TOKEN_PEPPER: process.env.STEP_UP_TOKEN_PEPPER?.trim(),
    STEP_UP_ENFORCEMENT_MODE: (process.env.STEP_UP_ENFORCEMENT_MODE || 'log_only').toLowerCase(),
    FILE_ENCRYPTION_KEY: process.env.FILE_ENCRYPTION_KEY,
    QR_TOKEN_TTL_SECONDS: parseNumber(process.env.QR_TOKEN_TTL_SECONDS, 300),
    QR_TOKEN_PEPPER: process.env.QR_TOKEN_PEPPER,
    QR_VERIFY_BASE_URL: process.env.QR_VERIFY_BASE_URL || 'http://localhost:5173',
    REALTIME_GATEWAY_URL: process.env.REALTIME_GATEWAY_URL || 'http://localhost:4900',
  };

if (!ENV.INTERNAL_SERVICE_TOKEN || ENV.INTERNAL_SERVICE_TOKEN.trim().length === 0) {
  throw new Error('INTERNAL_SERVICE_TOKEN is required for credential-service.');
}

if (!ENV.STEP_UP_TOKEN_PEPPER || ENV.STEP_UP_TOKEN_PEPPER.trim().length === 0) {
  throw new Error('STEP_UP_TOKEN_PEPPER is required for credential-service.');
}
