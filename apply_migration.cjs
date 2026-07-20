require('dotenv').config();

console.error([
  'Este executor foi desativado por segurança.',
  'Migrações não podem ser aplicadas pela chave pública VITE_SUPABASE_ANON_KEY nem por uma RPC execute_sql.',
  'Use: SUPABASE_DB_URL="..." node apply_pg_migration.cjs <arquivo.sql>',
].join('\n'));

process.exit(1);
