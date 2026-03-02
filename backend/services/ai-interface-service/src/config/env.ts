import dotenv from 'dotenv';

dotenv.config();

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
  PORT: Number(process.env.PORT) || 5500,
  DATABASE_URL: process.env.DATABASE_URL,
  PRISMA_SCHEMA_PATH: process.env.PRISMA_SCHEMA_PATH,
  CREDENTIAL_SERVICE_URL: process.env.CREDENTIAL_SERVICE_URL || 'http://localhost:5100',
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN,
  AI_ENABLED: parseBoolean(process.env.AI_ENABLED, true),
  AI_PROVIDER: process.env.AI_PROVIDER || 'managed',
  AI_MANAGED_ENDPOINT: process.env.AI_MANAGED_ENDPOINT,
  AI_MODEL: process.env.AI_MODEL || 'managed-fraud-v1',
  AI_MODEL_VERSION: process.env.AI_MODEL_VERSION || 'v1',
  AI_SCORE_CLEAR_THRESHOLD: parseNumber(process.env.AI_SCORE_CLEAR_THRESHOLD, 0.35),
  AI_SCORE_BLOCK_THRESHOLD: parseNumber(process.env.AI_SCORE_BLOCK_THRESHOLD, 0.7),
  AI_QUEUE_CONCURRENCY: Math.max(1, parseNumber(process.env.AI_QUEUE_CONCURRENCY, 3)),
  AI_QUEUE_RETRY_LIMIT: Math.max(1, parseNumber(process.env.AI_QUEUE_RETRY_LIMIT, 3)),
  AI_QUEUE_RETRY_DELAY_SECONDS: Math.max(1, parseNumber(process.env.AI_QUEUE_RETRY_DELAY_SECONDS, 30)),
};

