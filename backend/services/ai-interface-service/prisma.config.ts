import { defineConfig } from 'prisma/config';
import { ENV } from './src/config/env';

export default defineConfig({
  schema: ENV.PRISMA_SCHEMA_PATH,
  datasource: {
    url: ENV.DATABASE_URL,
  },
});

