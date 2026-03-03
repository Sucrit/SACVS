import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ENV } from '../config/env';

const FILE_MAGIC = Buffer.from('SACVS1');
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const ALGO = 'aes-256-gcm';

const parseEncryptionKey = (raw: string | undefined): Buffer => {
  if (!raw || raw.trim().length === 0) {
    throw new Error('FILE_ENCRYPTION_KEY_MISSING');
  }

  const value = raw.trim();

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, 'hex');
  }

  try {
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // Ignore; validated below.
  }

  const utf8 = Buffer.from(value, 'utf8');
  if (utf8.length === 32) {
    return utf8;
  }

  throw new Error('FILE_ENCRYPTION_KEY_INVALID');
};

const getEncryptionKey = (): Buffer => parseEncryptionKey(ENV.FILE_ENCRYPTION_KEY);

export const sha256Hex = (value: Buffer): string => createHash('sha256').update(value).digest('hex');

export const createEncryptedStorageName = (originalName: string): string => {
  const ext = path.extname(originalName || '').toLowerCase() || '.bin';
  const safeBase = path
    .basename(originalName || 'credential', ext)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${safeBase || 'credential'}-${unique}${ext}.enc`;
};

export const encryptBufferToFile = (plaintext: Buffer, outputPath: string): void => {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([FILE_MAGIC, iv, tag, encrypted]);
  writeFileSync(outputPath, payload);
};

export const decryptFileToBuffer = (inputPath: string): Buffer => {
  const key = getEncryptionKey();
  const payload = readFileSync(inputPath);

  const minLength = FILE_MAGIC.length + IV_LENGTH + TAG_LENGTH;
  if (payload.length <= minLength) {
    throw new Error('CREDENTIAL_FILE_INVALID');
  }

  const magic = payload.subarray(0, FILE_MAGIC.length);
  if (!magic.equals(FILE_MAGIC)) {
    throw new Error('CREDENTIAL_FILE_INVALID');
  }

  const ivStart = FILE_MAGIC.length;
  const ivEnd = ivStart + IV_LENGTH;
  const tagEnd = ivEnd + TAG_LENGTH;

  const iv = payload.subarray(ivStart, ivEnd);
  const tag = payload.subarray(ivEnd, tagEnd);
  const ciphertext = payload.subarray(tagEnd);

  try {
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('CREDENTIAL_FILE_TAMPERED');
  }
};

