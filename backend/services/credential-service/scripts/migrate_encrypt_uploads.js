/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const { PrismaClient } = require('../../../db/node_modules/@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

dotenv.config();

const PREFIX = '/credentials/uploads/';
const FILE_MAGIC = Buffer.from('SACVS1');
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const ALGO = 'aes-256-gcm';

const DRY_RUN = process.argv.includes('--dry-run');
const serviceRoot = path.resolve(__dirname, '..');
const uploadsDir = path.resolve(serviceRoot, 'src', 'uploads');

function parseEncryptionKey(raw) {
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
    // ignored
  }

  const utf8 = Buffer.from(value, 'utf8');
  if (utf8.length === 32) {
    return utf8;
  }

  throw new Error('FILE_ENCRYPTION_KEY_INVALID');
}

function hashHex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function isEncryptedPayload(buffer) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (buffer.length < FILE_MAGIC.length + IV_LENGTH + TAG_LENGTH + 1) return false;
  return buffer.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC);
}

function encryptBuffer(plaintext, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([FILE_MAGIC, iv, tag, encrypted]);
}

function decryptBuffer(payload, key) {
  if (!isEncryptedPayload(payload)) {
    throw new Error('CREDENTIAL_FILE_INVALID');
  }

  const ivStart = FILE_MAGIC.length;
  const ivEnd = ivStart + IV_LENGTH;
  const tagEnd = ivEnd + TAG_LENGTH;

  const iv = payload.subarray(ivStart, ivEnd);
  const tag = payload.subarray(ivEnd, tagEnd);
  const ciphertext = payload.subarray(tagEnd);

  try {
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('CREDENTIAL_FILE_TAMPERED');
  }
}

function resolveStorageAbsolutePath(storageKey) {
  const relative = storageKey.replace(/^\/credentials\/uploads\//, '');
  const absolute = path.resolve(uploadsDir, relative);
  const normalizedRoot = `${path.resolve(uploadsDir)}${path.sep}`;
  if (!(`${absolute}${path.sep}`).startsWith(normalizedRoot)) {
    throw new Error('INVALID_STORAGE_KEY_PATH');
  }
  return absolute;
}

function buildEncryptedPath(originalAbsolutePath) {
  const dir = path.dirname(originalAbsolutePath);
  const base = path.basename(originalAbsolutePath);
  let candidate = base.endsWith('.enc') ? base : `${base}.enc`;
  let candidateAbs = path.resolve(dir, candidate);
  let i = 1;
  while (fs.existsSync(candidateAbs) && candidateAbs !== originalAbsolutePath) {
    candidate = `${base}.${i}.enc`;
    candidateAbs = path.resolve(dir, candidate);
    i += 1;
  }
  return candidateAbs;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL_MISSING');
  }
  const encryptionKey = parseEncryptionKey(process.env.FILE_ENCRYPTION_KEY);

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const stats = {
    scanned: 0,
    missingFile: 0,
    encryptedMigrated: 0,
    storageKeyUpdated: 0,
    hashUpdated: 0,
    unchanged: 0,
    failed: 0,
  };

  const processedPathMap = new Map();

  try {
    const credentials = await prisma.credential.findMany({
      where: {
        storageKey: {
          not: null,
          startsWith: PREFIX,
        },
      },
      select: {
        id: true,
        storageKey: true,
        fileHash: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${credentials.length} credential records with upload storage keys.`);

    for (const credential of credentials) {
      stats.scanned += 1;
      const currentStorageKey = credential.storageKey;
      if (!currentStorageKey) {
        stats.unchanged += 1;
        continue;
      }

      try {
        const absolutePath = resolveStorageAbsolutePath(currentStorageKey);
        const cached = processedPathMap.get(absolutePath);
        let result = cached;

        if (!result) {
          if (!fs.existsSync(absolutePath)) {
            console.warn(`[missing] ${credential.id} -> ${currentStorageKey}`);
            stats.missingFile += 1;
            continue;
          }

          const raw = fs.readFileSync(absolutePath);
          let plaintext = raw;
          let nextStorageKey = currentStorageKey;
          let nextAbsolutePath = absolutePath;
          const alreadyEncrypted = isEncryptedPayload(raw);

          if (alreadyEncrypted) {
            plaintext = decryptBuffer(raw, encryptionKey);
          } else {
            const encryptedPayload = encryptBuffer(raw, encryptionKey);
            nextAbsolutePath = buildEncryptedPath(absolutePath);
            nextStorageKey = `${PREFIX}${path.basename(nextAbsolutePath)}`;

            if (!DRY_RUN) {
              fs.writeFileSync(nextAbsolutePath, encryptedPayload);
              fs.unlinkSync(absolutePath);
            }
            stats.encryptedMigrated += 1;
          }

          result = {
            hash: hashHex(plaintext),
            storageKey: nextStorageKey,
            absolutePath: nextAbsolutePath,
          };
          processedPathMap.set(absolutePath, result);
          processedPathMap.set(nextAbsolutePath, result);
        }

        const updateData = {};
        let changed = false;
        if (credential.storageKey !== result.storageKey) {
          updateData.storageKey = result.storageKey;
          changed = true;
          stats.storageKeyUpdated += 1;
        }
        if (credential.fileHash !== result.hash) {
          updateData.fileHash = result.hash;
          changed = true;
          stats.hashUpdated += 1;
        }

        if (changed) {
          if (!DRY_RUN) {
            await prisma.credential.update({
              where: { id: credential.id },
              data: updateData,
            });
          }
          console.log(
            `[updated] ${credential.id} storageKey:${credential.storageKey} -> ${result.storageKey}, fileHash:${credential.fileHash || '(null)'} -> ${result.hash}`,
          );
        } else {
          stats.unchanged += 1;
        }
      } catch (error) {
        stats.failed += 1;
        console.error(`[failed] ${credential.id}:`, error.message || error);
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log('--- Migration Summary ---');
  console.log(`dryRun: ${DRY_RUN}`);
  console.log(`scanned: ${stats.scanned}`);
  console.log(`encryptedMigrated: ${stats.encryptedMigrated}`);
  console.log(`storageKeyUpdated: ${stats.storageKeyUpdated}`);
  console.log(`hashUpdated: ${stats.hashUpdated}`);
  console.log(`missingFile: ${stats.missingFile}`);
  console.log(`unchanged: ${stats.unchanged}`);
  console.log(`failed: ${stats.failed}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

