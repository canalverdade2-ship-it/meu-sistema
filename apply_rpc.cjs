require('dotenv').config();

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.SUPABASE_DB_URL;
const sqlArgument = process.argv[2];

if (!connectionString) {
  console.error('SUPABASE_DB_URL não configurada. Operação cancelada.');
  process.exit(1);
}

if (!sqlArgument) {
  console.error('Uso: node apply_rpc.cjs <arquivo.sql>');
  process.exit(1);
}

const sqlPath = path.resolve(process.cwd(), sqlArgument);
if (!fs.existsSync(sqlPath)) {
  console.error(`Arquivo SQL não encontrado: ${sqlPath}`);
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await client.connect();
    await client.query(fs.readFileSync(sqlPath, 'utf8'));
    console.log(`RPC aplicada a partir de: ${sqlPath}`);
  } catch (error) {
    console.error('Erro ao aplicar RPC:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
