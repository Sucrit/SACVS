import crypto from 'crypto';

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function hashNullable(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return sha256Hex(value.trim().toLowerCase());
}
