import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    PRISMA_SCHEMA_PATH: process.env.PRISMA_SCHEMA_PATH,
};
