import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    PRISMA_SCHEMA_PATH: process.env.PRISMA_SCHEMA_PATH,
    CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5300',
    INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN,
};
