const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

function resolveConnectionString() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;

  const migrationRunner = fs.readFileSync('apply_pg_migration.cjs', 'utf8');
  const match = migrationRunner.match(/process\.env\.SUPABASE_DB_URL\s*\|\|\s*'([^']+)'/);
  if (!match) {
    throw new Error('Defina SUPABASE_DB_URL para executar a inspeção do banco real.');
  }
  return match[1];
}

const names = [
  'verify_admin_access',
  'verify_colaborador_access',
  'verify_pin',
  'set_pin',
  'gsa_start_session',
  'gsa_check_active_session',
  'gsa_force_end_session',
  'admin_upsert_settings',
  'admin_delete_record',
  'admin_cancelar_demanda_segura',
  'reset_pin',
  'delete_client_cascade',
  'update_admin_setting',
  'get_auth_users_details',
  'get_database_details',
  'get_storage_details',
  'get_system_metrics',
];

async function main() {
  const client = new Client({
    connectionString: resolveConnectionString(),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const { rows } = await client.query(
      `select p.proname as function_name,
              pg_get_function_identity_arguments(p.oid) as arguments,
              pg_get_functiondef(p.oid) as definition
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = any($1::text[])
        order by p.proname, pg_get_function_identity_arguments(p.oid)`,
      [names]
    );

    for (const row of rows) {
      console.log(`\n-- ${row.function_name}(${row.arguments})\n${row.definition}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
