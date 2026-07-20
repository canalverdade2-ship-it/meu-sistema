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
    const tables = ['clientes', 'indicacoes', 'vouchers', 'prestadores', 'orcamentos', 'notificacoes', 'system_settings', 'pontos_movimentacoes', 'points_transactions'];
    const columns = await client.query(`
      select table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
        from information_schema.columns
       where table_schema = 'public' and table_name = any($1::text[])
       order by table_name, ordinal_position
    `, [tables]);
    const constraints = await client.query(`
      select c.relname as table_name, con.conname as constraint_name, con.contype,
             pg_get_constraintdef(con.oid, true) as definition
        from pg_constraint con
        join pg_class c on c.oid = con.conrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = any($1::text[])
       order by c.relname, con.contype, con.conname
    `, [tables]);
    const functions = await client.query(`
      select p.proname, pg_get_function_identity_arguments(p.oid) as args,
             p.prosecdef as security_definer, p.provolatile as volatility,
             array_to_string(p.proacl, ',') as grants
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and (p.proname like 'gsa_%' or p.proname in ('secure_add_gamification_points'))
       order by p.proname, args
    `);
    const indexes = await client.query(`
      select tablename, indexname, indexdef
        from pg_indexes
       where schemaname = 'public' and tablename = any($1::text[])
       order by tablename, indexname
    `, [tables]);

    console.log(JSON.stringify({ columns: columns.rows, constraints: constraints.rows, functions: functions.rows, indexes: indexes.rows }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
