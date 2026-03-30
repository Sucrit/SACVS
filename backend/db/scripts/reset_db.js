const dotenv = require('dotenv');
const { Client } = require('pg');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function main() {
  const conn = process.env.DATABASE_URL?.replace(/^"|"$/g, '');
  if (!conn) {
    throw new Error('DATABASE_URL not set');
  }
  const client = new Client({ connectionString: conn });
  await client.connect();
  try {
    console.log('Dropping public schema...');
    await client.query('DROP SCHEMA public CASCADE;');
    console.log('Creating public schema...');
    await client.query('CREATE SCHEMA public;');
    console.log('Recreated schema.');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('reset failed', err);
  process.exit(1);
});
