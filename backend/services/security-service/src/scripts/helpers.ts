import fs from 'fs';
import path from 'path';
import { ENV } from '../config/env';

type MetadataRecord = Record<string, unknown>;
type ArtifactKind = 'datasets' | 'models' | 'metrics' | 'manifests';

function isObject(value: unknown): value is MetadataRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseMetadata(metadata: unknown): MetadataRecord {
  if (isObject(metadata)) {
    return metadata;
  }
  return {};
}

export function pickString(metadata: MetadataRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const stringified = String(value);
  if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
    return `"${stringified.replace(/"/g, '""')}"`;
  }
  return stringified;
}

export function ensureArtifactsDir(): string {
  fs.mkdirSync(ENV.RISK_ARTIFACTS_DIR, { recursive: true });
  return ENV.RISK_ARTIFACTS_DIR;
}

export function ensureArtifactSubdir(kind: ArtifactKind): string {
  ensureArtifactsDir();
  const subdir = path.resolve(ENV.RISK_ARTIFACTS_DIR, kind);
  fs.mkdirSync(subdir, { recursive: true });
  return subdir;
}

export function resolveArtifactPath(kind: ArtifactKind, filename: string): string {
  return path.resolve(ensureArtifactSubdir(kind), filename);
}

export function parseArgs(argv: string[]): Record<string, string> {
  const options: Record<string, string> = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      continue;
    }
    const [rawKey, ...rest] = arg.slice(2).split('=');
    if (!rawKey) {
      continue;
    }
    options[rawKey] = rest.length > 0 ? rest.join('=') : 'true';
  }
  return options;
}
