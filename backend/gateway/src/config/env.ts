import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envCandidates = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../../db/.env'),
];

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate, override: false });
  }
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseRequiredString(value: string | undefined, label: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${label} is required for gateway telemetry.`);
  }
  return trimmed;
}

export const ENV = {
  PORT: Number(process.env.PORT) || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL:
    parseBoolean(process.env.GATEWAY_TELEMETRY_ENABLED, true)
      ? parseRequiredString(process.env.DATABASE_URL, 'DATABASE_URL')
      : process.env.DATABASE_URL || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://localhost:5000',
  CREDENTIALS_SERVICE_URL: process.env.CREDENTIALS_SERVICE_URL || 'http://localhost:5100',
  CREDENTIAL_REQUEST_SERVICE_URL: process.env.CREDENTIAL_REQUEST_SERVICE_URL || 'http://localhost:5200',
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5300',
  BLOCKCHAIN_INTERFACE_SERVICE_URL:
    process.env.BLOCKCHAIN_INTERFACE_SERVICE_URL || 'http://localhost:5400',
  SECURITY_SERVICE_URL: process.env.SECURITY_SERVICE_URL || 'http://localhost:5500',
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX) || 100,
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN,
  GATEWAY_TELEMETRY_ENABLED: parseBoolean(process.env.GATEWAY_TELEMETRY_ENABLED, true),
};
