import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: Number(process.env.PORT) || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://localhost:5000',
  CREDENTIALS_SERVICE_URL: process.env.CREDENTIALS_SERVICE_URL || 'http://localhost:5100',
  CREDENTIAL_REQUEST_SERVICE_URL: process.env.CREDENTIAL_REQUEST_SERVICE_URL || 'http://localhost:5200',
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5300',
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:5500',
  BLOCKCHAIN_INTERFACE_SERVICE_URL:
    process.env.BLOCKCHAIN_INTERFACE_SERVICE_URL || 'http://localhost:5400',
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX) || 100,
};
