import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
};

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (typeof value !== 'string') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const ENV = {
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    PRISMA_SCHEMA_PATH: process.env.PRISMA_SCHEMA_PATH,
    CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5300',
    BLOCKCHAIN_INTERFACE_SERVICE_URL:
      process.env.BLOCKCHAIN_INTERFACE_SERVICE_URL || 'http://localhost:5400',
    INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN,
    AI_ENABLED: parseBoolean(process.env.AI_ENABLED, true),
    AI_ENFORCE_GATE: parseBoolean(process.env.AI_ENFORCE_GATE, true),
    AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:5500',
    AI_SCORE_CLEAR_THRESHOLD: parseNumber(process.env.AI_SCORE_CLEAR_THRESHOLD, 0.35),
    AI_SCORE_BLOCK_THRESHOLD: parseNumber(process.env.AI_SCORE_BLOCK_THRESHOLD, 0.7),
    FILE_ENCRYPTION_KEY: process.env.FILE_ENCRYPTION_KEY,
};
