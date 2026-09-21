const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sshKey = 'C:\\Users\\Adriano Farias\\Downloads\\CLOUD\\ssh-key-2026-07-30.key';
const host = 'opc@147.15.43.141';

function runSql(sql) {
  const cleanSql = sql.replace(//g, '"');
 const cmd = ssh -i  -o StrictHostKeyChecking=no -o ConnectTimeout=15 System.Management.Automation.Internal.Host.InternalHost PGPASSWORD=GSA_SENHA_FORTE_2026 psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -t -A -F '|||' -c "";
 return execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
}

console.log('Querying VPS PostgreSQL...');

// 1. Tables
console.log('Fetching tables...');
const tablesRaw = runSql(SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;);
const tables = tablesRaw.trim().split('\n').filter(Boolean).map(line => {
 const [table_name, table_type] = line.split('|||');
 return { table_name, table_type };
});

// 2. Columns
console.log('Fetching columns...');
const columnsRaw = runSql(SELECT table_name, column_name, data_type, is_nullable, COALESCE(column_default, '') FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;);
const columns = columnsRaw.trim().split('\n').filter(Boolean).map(line => {
 const [table_name, column_name, data_type, is_nullable, column_default] = line.split('|||');
 return { table_name, column_name, data_type, is_nullable, column_default };
});

// 3. RPC Functions
console.log('Fetching RPC functions...');
const rpcRaw = runSql(
SELECT 
 p.proname AS func_name,
 pg_get_function_arguments(p.oid) AS arguments,
 pg_get_function_result(p.oid) AS return_type,
 p.prosecdef AS is_security_definer,
 l.lanname AS language,
 COALESCE(array_to_string(p.proacl, '; '), '') AS acl
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;
);
const rpcs = rpcRaw.trim().split('\n').filter(Boolean).map(line => {
 const [func_name, arguments, return_type, is_security_definer, language, acl] = line.split('|||');
 return { func_name, arguments, return_type, is_security_definer: is_security_definer === 't', language, acl };
});

// 4. RLS Policies
console.log('Fetching RLS policies...');
const rlsRaw = runSql(SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;);
const rls = rlsRaw.trim().split('\n').filter(Boolean).map(line => {
 const [tablename, policyname, permissive, roles, cmd, qual, with_check] = line.split('|||');
 return { tablename, policyname, permissive, roles, cmd, qual, with_check };
});

// 5. System Settings
console.log('Fetching system_settings keys...');
const settingsRaw = runSql(SELECT key, COALESCE(left(value::text, 120), '') FROM public.system_settings ORDER BY key;);
const settings = settingsRaw.trim().split('\n').filter(Boolean).map(line => {
 const [key, value_preview] = line.split('|||');
 return { key, value_preview };
});

// 6. Schema migrations table if exists
console.log('Checking migration tables...');
let schemaMigrations = [];
try {
 const migRaw = runSql(SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;);
 schemaMigrations = migRaw.trim().split('\n').filter(Boolean);
} catch (e) {
 try {
 const migRaw2 = runSql(SELECT version FROM public.schema_migrations ORDER BY version;);
 schemaMigrations = migRaw2.trim().split('\n').filter(Boolean);
 } catch (e2) {
 schemaMigrations = ['(schema_migrations table not found or not queryable)'];
 }
}

const dbDump = {
 tableCount: tables.length,
 tables,
 columnCount: columns.length,
 columns,
 rpcCount: rpcs.length,
 rpcs,
 rlsPolicyCount: rls.length,
 rls,
 settingsCount: settings.length,
 settings,
 schemaMigrations
};

fs.writeFileSync('.agents/explorer_db_survey_1/vps_db_dump.json', JSON.stringify(dbDump, null, 2));
console.log('Database dump saved: ' + tables.length + ' tables, ' + columns.length + ' columns, ' + rpcs.length + ' RPCs, ' + rls.length + ' RLS policies, ' + settings.length + ' system_settings.');

