const { Client } = require('pg');
const connectionString = 'postgresql://postgres:%40Ad98653200%40@db.ocgajvagxagutfvgxwsy.supabase.co:5432/postgres';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
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
    
    const res = await client.query(query);
    console.log(JSON.stringify(res.rows, null, 2));
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
