import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envCandidates = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../../../.env'),
  path.resolve(__dirname, '../../../../db/.env'),
];

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate, override: false });
  }
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseRequiredString(value: string | undefined, label: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${label} is required for security-service.`);
  }
  return trimmed;
}

function parseOptionalString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export const ENV = {
  PORT: parseNumber(process.env.PORT, 5500),
  NODE_ENV: process.env.NODE_ENV?.trim() || 'development',
  DATABASE_URL: parseRequiredString(process.env.DATABASE_URL, 'DATABASE_URL'),
  CLERK_PUBLISHABLE_KEY: parseRequiredString(
    process.env.CLERK_PUBLISHABLE_KEY,
    'CLERK_PUBLISHABLE_KEY',
  ),
  CLERK_SECRET_KEY: parseRequiredString(process.env.CLERK_SECRET_KEY, 'CLERK_SECRET_KEY'),
  REALTIME_GATEWAY_URL: process.env.REALTIME_GATEWAY_URL?.trim() || 'http://localhost:4900',
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL?.trim() || 'http://localhost:5300',
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN?.trim() || '',
  RISK_ARTIFACTS_DIR: path.resolve(
    process.cwd(),
    process.env.RISK_ARTIFACTS_DIR?.trim() || 'artifacts',
  ),
  RISK_DATASET_LOOKBACK_HOURS: parseNumber(process.env.RISK_DATASET_LOOKBACK_HOURS, 180 * 24),
  RISK_SHADOW_LOOKBACK_MINUTES: parseNumber(process.env.RISK_SHADOW_LOOKBACK_MINUTES, 15),
  RISK_SHADOW_AUTORUN: parseBoolean(process.env.RISK_SHADOW_AUTORUN, true),
  RISK_SHADOW_INTERVAL_MS: Math.max(
    5_000,
    parseNumber(process.env.RISK_SHADOW_INTERVAL_MS, 60_000),
  ),
  RISK_SHADOW_OVERLAP_MINUTES: Math.max(
    1,
    parseNumber(process.env.RISK_SHADOW_OVERLAP_MINUTES, 5),
  ),
  RISK_SHADOW_BATCH_LIMIT: Math.max(
    1,
    parseNumber(process.env.RISK_SHADOW_BATCH_LIMIT, 500),
  ),
  GATEWAY_TELEMETRY_RETENTION_DAYS: Math.max(
    1,
    parseNumber(process.env.GATEWAY_TELEMETRY_RETENTION_DAYS, 30),
  ),
  GATEWAY_TELEMETRY_CLEANUP_INTERVAL_MS: Math.max(
    60_000,
    parseNumber(process.env.GATEWAY_TELEMETRY_CLEANUP_INTERVAL_MS, 6 * 60 * 60_000),
  ),
  RISK_SUPERVISED_WEIGHT: parseNumber(process.env.RISK_SUPERVISED_WEIGHT, 0.75),
  RISK_ANOMALY_WEIGHT: parseNumber(process.env.RISK_ANOMALY_WEIGHT, 0.25),
  RISK_BAND_HIGH_THRESHOLD: parseNumber(process.env.RISK_BAND_HIGH_THRESHOLD, 70),
  RISK_BAND_CRITICAL_THRESHOLD: parseNumber(process.env.RISK_BAND_CRITICAL_THRESHOLD, 85),
  GEMINI_API_KEY: parseOptionalString(process.env.GEMINI_API_KEY),
  GEMINI_MODEL: parseOptionalString(process.env.GEMINI_MODEL) || 'gemini-2.0-flash',
  GEMINI_TIMEOUT_MS: Math.max(2_000, parseNumber(process.env.GEMINI_TIMEOUT_MS, 15_000)),
} as const;
