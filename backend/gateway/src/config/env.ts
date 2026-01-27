import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  USER_SERVICE_URL: process.env.USER_SERVICE_URL,
};
