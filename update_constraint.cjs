require('dotenv').config();

const { Client } = require('pg');

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('SUPABASE_DB_URL não configurada. Operação cancelada.');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await client.connect();
    await client.query(`
      ALTER TABLE public.ordens_assinatura
      DROP CONSTRAINT IF EXISTS ordens_assinatura_status_check;

      ALTER TABLE public.ordens_assinatura
      ADD CONSTRAINT ordens_assinatura_status_check
      CHECK (status IN ('em_analise', 'concluido', 'em_cancelamento', 'cancelado', 'pago'));
    `);
    console.log('Restrição de ordens_assinatura atualizada com sucesso.');
  } catch (error) {
    console.error('Erro ao atualizar restrição:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
