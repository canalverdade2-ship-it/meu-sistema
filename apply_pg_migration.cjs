const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const migrationPath = process.argv[2];

if (!migrationPath) {
  console.error('Uso: node apply_pg_migration.cjs <arquivo.sql>');
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL || 'postgresql://postgres:%40Ad98653200%40@db.ocgajvagxagutfvgxwsy.supabase.co:5432/postgres';
const sqlPath = path.resolve(process.cwd(), migrationPath);
const sql = fs.readFileSync(sqlPath, 'utf8');

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await client.connect();
    await client.query(sql);
    console.log(`Migration aplicada: ${migrationPath}`);
  } catch (error) {
    console.error('Erro ao aplicar migration:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
