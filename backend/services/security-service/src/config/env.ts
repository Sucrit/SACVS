import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../../db/.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../../../.env'),
  path.resolve(__dirname, '../../../../db/.env'),
];

for (const envPath of new Set(envCandidates)) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

function readNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be numeric. Received: ${value}`);
  }
  return parsed;
}

export const ENV = {
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  RISK_ARTIFACTS_DIR: process.env.RISK_ARTIFACTS_DIR
    ? path.resolve(process.cwd(), process.env.RISK_ARTIFACTS_DIR)
    : path.resolve(process.cwd(), 'artifacts'),
  RISK_DATASET_LOOKBACK_HOURS: readNumber('RISK_DATASET_LOOKBACK_HOURS', 24 * 180),
  RISK_SHADOW_LOOKBACK_MINUTES: readNumber('RISK_SHADOW_LOOKBACK_MINUTES', 15),
  RISK_SUPERVISED_WEIGHT: readNumber('RISK_SUPERVISED_WEIGHT', 0.75),
  RISK_ANOMALY_WEIGHT: readNumber('RISK_ANOMALY_WEIGHT', 0.25),
  RISK_BAND_HIGH_THRESHOLD: readNumber('RISK_BAND_HIGH_THRESHOLD', 70),
  RISK_BAND_CRITICAL_THRESHOLD: readNumber('RISK_BAND_CRITICAL_THRESHOLD', 85),
};

if (!ENV.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for security-service.');
}
