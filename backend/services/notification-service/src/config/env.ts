import dotenv from 'dotenv';

dotenv.config();

export const ENV = {
  PORT: process.env.PORT || '5300',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/sacvs_db?schema=public',
  PRISMA_SCHEMA_PATH: process.env.PRISMA_SCHEMA_PATH || '../../db/schema.prisma',
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN,
};
