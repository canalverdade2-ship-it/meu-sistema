const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

function connectionString() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const source = fs.readFileSync('apply_pg_migration.cjs', 'utf8');
  const match = source.match(/process\.env\.SUPABASE_DB_URL\s*\|\|\s*'([^']+)'/);
  if (!match) throw new Error('Defina SUPABASE_DB_URL.');
  return match[1];
}

async function main() {
  const client = new Client({ connectionString: connectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const { rows } = await client.query(`
      select c.relname as table_name, con.conname as constraint_name,
             pg_get_constraintdef(con.oid, true) as definition
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = any($1::text[])
        and con.contype = 'c'
      order by c.relname, con.conname
    `, [[
      'ordens_servico', 'ordens_compra', 'ordens_assinatura', 'orcamentos',
      'faturas', 'indicacoes', 'prestador_demandas', 'emprestimos',
      'pontos_movimentacoes', 'points_transactions', 'loja_credito_movimentacoes',
      'pagamentos',
    ]]);
    console.log(rows.map((row) => `${row.table_name}.${row.constraint_name}: ${row.definition}`).join('\n'));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
