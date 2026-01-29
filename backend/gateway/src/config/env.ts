import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: Number(process.env.PORT) || 4000,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://localhost:5000',
  CREDENTIALS_SERVICE_URL: process.env.CREDENTIALS_SERVICE_URL || 'http://localhost:5100',
};
