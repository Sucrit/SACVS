import fs from 'node:fs';
import path from 'node:path';

const serviceRoot = process.cwd();

export const CREDENTIAL_UPLOADS_DIR = path.resolve(serviceRoot, 'src', 'uploads');

export const ensureCredentialUploadsDir = () => {
  if (!fs.existsSync(CREDENTIAL_UPLOADS_DIR)) {
    fs.mkdirSync(CREDENTIAL_UPLOADS_DIR, { recursive: true });
  }
};

