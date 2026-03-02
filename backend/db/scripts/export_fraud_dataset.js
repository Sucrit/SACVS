const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { Client } = require('pg');

const backendRoot = path.resolve(__dirname, '..', '..');
const dbEnvPath = path.resolve(__dirname, '..', '.env');
const sqlPath = path.resolve(backendRoot, 'ai-model-service', 'sql', 'export_fraud_dataset.sql');
const outputPath = path.resolve(backendRoot, 'ai-model-service', 'data', 'fraud_dataset.csv');

dotenv.config({ path: dbEnvPath });

const escapeCsv = (value) => {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n') || raw.includes('\r')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

async function main() {
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`SQL file not found: ${sqlPath}`);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8').trim();
  const databaseUrl = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '');
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is missing in backend/db/.env');
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    const result = await client.query(sql);
    const rows = result.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      console.log('Query returned 0 rows. Creating CSV with headers from known schema.');
      const headers = [
        'label_fraud',
        'credential_type',
        'credential_status',
        'mime_type',
        'filename_len',
        'has_file_hash',
        'duplicate_hash_count',
        'cross_institution_hash_reuse',
        'ai_score_prev',
        'issuer_role',
        'student_status',
      ];
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${headers.join(',')}\n`, 'utf8');
      console.log(`Exported empty dataset with headers to: ${outputPath}`);
      return;
    }

    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];

    for (const row of rows) {
      const line = headers.map((header) => escapeCsv(row[header])).join(',');
      lines.push(line);
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
    console.log(`Exported ${rows.length} rows to: ${outputPath}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Failed exporting fraud dataset:', error);
  process.exit(1);
});
