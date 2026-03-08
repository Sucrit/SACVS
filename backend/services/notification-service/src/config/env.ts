import dotenv from 'dotenv';

dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  PRISMA_SCHEMA_PATH: process.env.PRISMA_SCHEMA_PATH || '../../db/schema.prisma',
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN,
  REALTIME_GATEWAY_URL: process.env.REALTIME_GATEWAY_URL,
};

if (
  ENV.NODE_ENV === 'production' &&
  (!ENV.INTERNAL_SERVICE_TOKEN || ENV.INTERNAL_SERVICE_TOKEN.trim().length === 0)
) {
  throw new Error('INTERNAL_SERVICE_TOKEN is required for notification-service in production mode.');
}
