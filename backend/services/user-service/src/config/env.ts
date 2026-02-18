import dotenv from "dotenv"
dotenv.config()

export const ENV = {
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_ADMIN_SECRET_KEY: process.env.CLERK_ADMIN_SECRET_KEY,
    CREDENTIALS_SERVICE_URL: process.env.CREDENTIALS_SERVICE_URL,
}
