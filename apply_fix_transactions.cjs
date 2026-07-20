require('dotenv').config();

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('SUPABASE_DB_URL não configurada. Operação cancelada.');
  process.exit(1);
}

const sqlPath = path.join(__dirname, 'fix_database_transactions.sql');
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
    console.log('fix_database_transactions.sql executado com sucesso.');
  } catch (error) {
    console.error('Erro ao executar correção de transações:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
