const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

function resolveConnectionString() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const runner = fs.readFileSync('apply_pg_migration.cjs', 'utf8');
  const match = runner.match(/process\.env\.SUPABASE_DB_URL\s*\|\|\s*'([^']+)'/);
  if (!match) throw new Error('Defina SUPABASE_DB_URL para executar a inspeção.');
  return match[1];
}

async function main() {
  const client = new Client({
    connectionString: resolveConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const extensions = await client.query(`
      select name, default_version, installed_version
      from pg_available_extensions
      where name in ('pgjwt', 'pgcrypto', 'supabase_vault')
      order by name
    `);
    const settings = await client.query(`
      select
        nullif(current_setting('app.settings.jwt_secret', true), '') is not null as jwt_secret_available,
        nullif(current_setting('app.settings.jwt_exp', true), '') is not null as jwt_exp_available
    `);
    const signFunctions = await client.query(`
      select n.nspname as schema_name, p.proname as function_name,
             pg_get_function_identity_arguments(p.oid) as arguments
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.proname in ('sign', 'url_encode', 'algorithm_sign')
      order by n.nspname, p.proname
    `);
    const authConfig = await client.query(`
      select count(*)::int as auth_users,
             count(*) filter (where is_anonymous is true)::int as anonymous_users
      from auth.users
    `);
    const authInstances = await client.query(`
      select id, uuid, raw_base_config
      from auth.instances
      order by created_at
      limit 5
    `);
    const authTriggers = await client.query(`
      select c.relname as table_name, t.tgname as trigger_name,
             pg_get_triggerdef(t.oid, true) as definition
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'auth'
        and c.relname in ('users', 'identities')
        and not t.tgisinternal
      order by c.relname, t.tgname
    `);
    const authGeneratedColumns = await client.query(`
      select column_name, is_generated, generation_expression
      from information_schema.columns
      where table_schema = 'auth'
        and table_name in ('users', 'identities')
        and column_name in ('confirmed_at', 'email_confirmed_at', 'email')
      order by ordinal_position
    `);

    console.log(JSON.stringify({
      extensions: extensions.rows,
      settings: settings.rows[0],
      signFunctions: signFunctions.rows,
      auth: authConfig.rows[0],
      authInstances: authInstances.rows.map((row) => ({ id: row.id, uuid: row.uuid })),
      authTriggers: authTriggers.rows,
      authGeneratedColumns: authGeneratedColumns.rows,
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
