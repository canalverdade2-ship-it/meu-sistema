const fs = require('fs');
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
  const client = new Client({ connectionString: connectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const defaultTables = [
      'produtos', 'assinaturas', 'servicos_assinaturas', 'cupons_loja', 'promocoes_quantidade',
      'promocoes_quantidade_uso', 'cliente_promocoes', 'promocoes', 'orcamentos',
      'ordens_compra', 'ordens_assinatura', 'ordens_servico', 'servicos', 'loja_carrinhos',
      'loja_credito_movimentacoes', 'faturas', 'promocoes_quantidade_ativadas',
      'clientes', 'points_transactions', 'pontos_movimentacoes', 'carteira_extrato',
      'transferencias', 'saques', 'loja_credito_configuracoes', 'loja_credito_solicitacoes',
      'loja_credito_parcelas', 'loja_niveis_vip', 'cliente_nivel_vip', 'notificacoes',
      'carteira_lancamentos', 'extrato_carteira', 'extrato_financeiro', 'cupons_ativados',
      'orcamento_timeline', 'loja_reembolsos', 'pagamentos', 'empresa', 'client_levels',
      'emprestimos', 'emprestimo_parcelas', 'emprestimo_historico', 'vouchers',
      'loja_solicitacoes', 'prestador_demandas', 'cliente_pacotes_nivel',
      'cliente_level_subscriptions', 'assinaturas_cliente', 'system_settings'
    ];
    const args = process.argv.slice(2);
    const compact = args.includes('--compact');
    const requestedTables = args.filter((arg) => !arg.startsWith('--'));
    const tables = requestedTables.length > 0 ? requestedTables : defaultTables;
    const { rows: columns } = await client.query(`
      select table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
      from information_schema.columns where table_schema='public' and table_name=any($1::text[])
      order by table_name, ordinal_position
    `, [tables]);
    const { rows: constraints } = await client.query(`
      select c.relname table_name, con.conname constraint_name, con.contype,
             pg_get_constraintdef(con.oid, true) definition
      from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=any($1::text[])
      order by c.relname, con.contype, con.conname
    `, [tables]);
    const { rows: settings } = await client.query(`
      select key, value from public.system_settings
      where key like 'loja_%' or key like '%credito%' or key like '%pontos%'
      order by key
    `);
    if (compact) {
      const compactColumns = Object.groupBy(columns, (column) => column.table_name);
      for (const [table, tableColumns] of Object.entries(compactColumns)) {
        console.log(`\n[${table}]`);
        for (const column of tableColumns) {
          console.log(`${column.column_name} ${column.udt_name} ${column.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}${column.column_default ? ` DEFAULT ${column.column_default}` : ''}`);
        }
        for (const constraint of constraints.filter((item) => item.table_name === table)) {
          console.log(`CONSTRAINT ${constraint.constraint_name}: ${constraint.definition}`);
        }
      }
      return;
    }
    console.log(JSON.stringify({ columns, constraints, settings }, null, 2));
  } finally { await client.end(); }
}

main().catch((error) => { console.error(error.message || error); process.exitCode = 1; });
