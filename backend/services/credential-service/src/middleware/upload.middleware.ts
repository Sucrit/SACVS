import multer from 'multer';
import { ensureCredentialUploadsDir, CREDENTIAL_UPLOADS_DIR } from '../config/uploads';

ensureCredentialUploadsDir();

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
]);

const fileFilter: multer.Options['fileFilter'] = (_req, file, callback) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    callback(new Error('INVALID_FILE_TYPE'));
    return;
  }
  callback(null, true);
};

export const credentialUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});
