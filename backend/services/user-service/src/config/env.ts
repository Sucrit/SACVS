import dotenv from "dotenv"
dotenv.config()

export const ENV = {
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_ADMIN_SECRET_KEY: process.env.CLERK_ADMIN_SECRET_KEY,
    JWT_SECRET: process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV || 'development',
    PRISMA_SCHEMA_PATH: process.env.PRISMA_SCHEMA_PATH,
    CREDENTIALS_SERVICE_URL: process.env.CREDENTIALS_SERVICE_URL || 'http://localhost:5100',
}
