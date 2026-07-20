const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ quiet: true });

function connectionString() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const source = fs.readFileSync('apply_pg_migration.cjs', 'utf8');
  const match = source.match(/process\.env\.SUPABASE_DB_URL\s*\|\|\s*'([^']+)'/);
  if (!match) throw new Error('Defina SUPABASE_DB_URL.');
  return match[1];
}

async function main() {
  const migrationPath = process.argv[2];
  if (!migrationPath) throw new Error('Uso: node scratch/test_migration_rollback.cjs <migration.sql>');

  const sql = fs.readFileSync(path.resolve(migrationPath), 'utf8');
  const validationPath = process.argv[3];
  const validationSql = validationPath
    ? fs.readFileSync(path.resolve(validationPath), 'utf8')
    : '';
  const client = new Client({
    connectionString: connectionString(),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    if (validationSql) await client.query(validationSql);
    await client.query('ROLLBACK');
    console.log(`Migration validada com ROLLBACK: ${migrationPath}${validationPath ? ` + ${validationPath}` : ''}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
