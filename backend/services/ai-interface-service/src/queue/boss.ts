import PgBoss from 'pg-boss';
import { ENV } from '../config/env';

if (!ENV.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured for ai-interface-service.');
}

const pgBoss = new PgBoss({
  connectionString: ENV.DATABASE_URL,
});

export const ANALYZE_JOB_NAME = 'credential.fraud.analyze';
export { pgBoss };

