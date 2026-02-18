import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
    PORT: process.env.PORT || '5100',
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // db
    DATABASE_URL: process.env.DATABASE_URL,

    // Paths
    PRISMA_SCHEMA_PATH: process.env.PRISMA_SCHEMA_PATH,
    DOCUMENTS_DIR: process.env.DOCUMENTS_DIR,
    
    // Clerk
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_ADMIN_SECRET_KEY: process.env.CLERK_ADMIN_SECRET_KEY,

    // Blockchain
    BLOCKCHAIN_RPC_URL: process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:7545',
    BLOCKCHAIN_CONTRACT_ADDRESS: process.env.BLOCKCHAIN_CONTRACT_ADDRESS,
    BLOCKCHAIN_ADMIN_PRIVATE_KEY: process.env.BLOCKCHAIN_ADMIN_PRIVATE_KEY,
    
    // AI
    AI_SERVICE_URL: process.env.AI_SERVICE_URL,
    AI_ENABLED: process.env.AI_ENABLED === 'true',
};
