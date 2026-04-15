import dotenv from 'dotenv';
dotenv.config();

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  PRISMA_SCHEMA_PATH: process.env.PRISMA_SCHEMA_PATH || '../../db/schema.prisma',
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5300',
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN,
  STEP_UP_TOKEN_PEPPER: process.env.STEP_UP_TOKEN_PEPPER?.trim(),
  STEP_UP_OTP_TTL_SECONDS: parseNumber(process.env.STEP_UP_OTP_TTL_SECONDS, 300),
  STEP_UP_SESSION_TTL_SECONDS: parseNumber(process.env.STEP_UP_SESSION_TTL_SECONDS, 300),
  STEP_UP_ISSUANCE_SESSION_TTL_SECONDS: parseNumber(process.env.STEP_UP_ISSUANCE_SESSION_TTL_SECONDS, 900),
  STEP_UP_MAX_ATTEMPTS: parseNumber(process.env.STEP_UP_MAX_ATTEMPTS, 5),
  STEP_UP_ENFORCEMENT_MODE: (process.env.STEP_UP_ENFORCEMENT_MODE || 'log_only').toLowerCase(),
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: (process.env.SMTP_SECURE || 'false').toLowerCase(),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM,
  REALTIME_GATEWAY_URL: process.env.REALTIME_GATEWAY_URL || 'http://localhost:4900',
};

if (!ENV.STEP_UP_TOKEN_PEPPER || ENV.STEP_UP_TOKEN_PEPPER.trim().length === 0) {
  throw new Error('STEP_UP_TOKEN_PEPPER is required for user-service.');
}

if (
  (ENV.NODE_ENV || 'development') !== 'production' &&
  (!ENV.SMTP_HOST || !ENV.SMTP_USER || !ENV.SMTP_PASS || !ENV.SMTP_FROM)
) {
  console.warn('[user-service] SMTP is not fully configured. Step-up OTP email delivery is disabled.');
}
