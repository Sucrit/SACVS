import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: err.message });
  }

  if (err instanceof Error && err.message === 'INVALID_FILE_TYPE') {
    return res.status(400).json({ error: 'Invalid file type. Use PNG, JPEG, WEBP, or PDF.' });
  }

  console.error(err);

  return res.status(500).json({ error: 'Internal Server Error' });
}
