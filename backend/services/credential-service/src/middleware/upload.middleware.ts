import multer from 'multer';
import path from 'node:path';
import { ensureCredentialUploadsDir, CREDENTIAL_UPLOADS_DIR } from '../config/uploads';

ensureCredentialUploadsDir();

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, CREDENTIAL_UPLOADS_DIR);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.bin';
    const safeBase = path
      .basename(file.originalname || 'credential', extension)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    callback(null, `${safeBase || 'credential'}-${unique}${extension}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, callback) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    callback(new Error('INVALID_FILE_TYPE'));
    return;
  }
  callback(null, true);
};

export const credentialUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

