import { defineConfig } from 'prisma/config';
import { ENV } from './src/config/env';

export default defineConfig({
  schema: './src/db/schema.prisma',
  datasource: {
    url: ENV.DATABASE_URL,
  },
}); 