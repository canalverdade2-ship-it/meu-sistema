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

    const query = `
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name IN (
        'orcamentos', 'ordens_compra', 'produtos', 'clientes',
        'points_transactions', 'pontos_movimentacoes', 'faturas',
        'extrato_financeiro', 'loja_credito_movimentacoes',
        'vouchers', 'pagamentos', 'loja_reembolsos', 'orcamento_timeline'
      )
      ORDER BY table_name, ordinal_position;
    `;

    const result = await client.query(query);
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('Erro ao consultar esquema:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
