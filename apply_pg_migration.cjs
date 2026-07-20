require('dotenv').config();

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const migrationPath = process.argv[2];
const connectionString = process.env.SUPABASE_DB_URL;

if (!migrationPath) {
  console.error('Uso: node apply_pg_migration.cjs <arquivo.sql>');
  process.exit(1);
}

if (!connectionString) {
  console.error('SUPABASE_DB_URL não configurada. A migração foi bloqueada para evitar uso de credenciais embutidas no código.');
  process.exit(1);
}

const sqlPath = path.resolve(process.cwd(), migrationPath);
if (!fs.existsSync(sqlPath)) {
  console.error(`Arquivo de migração não encontrado: ${sqlPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await client.connect();
    await client.query(sql);
    console.log(`Migração aplicada: ${migrationPath}`);
  } catch (error) {
    console.error('Erro ao aplicar migração:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
