import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ENV } from '../config/env';

const DEFAULT_DOCUMENTS_DIR = path.resolve(process.cwd(), '../../documents');
const DOCUMENTS_DIR = path.resolve(ENV.DOCUMENTS_DIR || DEFAULT_DOCUMENTS_DIR);
const DOCUMENT_UPLOAD_DIR = path.join(DOCUMENTS_DIR, 'uploads');

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'text/plain': '.txt',
  'application/json': '.json',
};

function nowStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function rand(): string {
  return crypto.randomBytes(4).toString('hex');
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'file';
}

function extensionFromName(filename?: string): string | undefined {
  if (!filename) return undefined;
  const ext = path.extname(filename).trim();
  return ext || undefined;
}

function extensionFromMime(mimeType?: string): string | undefined {
  if (!mimeType) return undefined;
  return MIME_EXTENSION_MAP[mimeType.toLowerCase()];
}

function parseBase64Payload(payload: string, mimeType?: string) {
  const dataUrlMatch = payload.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1],
      base64: dataUrlMatch[2],
    };
  }
  return {
    mimeType: mimeType || 'application/octet-stream',
    base64: payload,
  };
}

async function ensureArchiveDir() {
  await fs.mkdir(DOCUMENT_UPLOAD_DIR, { recursive: true });
}

export async function archiveCredentialDocument(input: {
  documentBase64: string;
  mimeType?: string;
  originalName?: string;
  tag?: string;
}): Promise<string> {
  await ensureArchiveDir();
  const parsed = parseBase64Payload(input.documentBase64, input.mimeType);
  const baseName = safeSegment(input.originalName || input.tag || 'credential');
  const ext = extensionFromName(input.originalName) || extensionFromMime(parsed.mimeType) || '.bin';
  const filename = `${nowStamp()}-${baseName}-${rand()}${ext}`;
  const fullPath = path.join(DOCUMENT_UPLOAD_DIR, filename);
  const buffer = Buffer.from(parsed.base64, 'base64');
  await fs.writeFile(fullPath, buffer);
  return fullPath;
}
