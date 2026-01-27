import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ENV } from '../config/env';

const connectionString = ENV.DATABASE_URL;
if (!connectionString) {
  throw new Error('Database connection string error');
}

const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });
