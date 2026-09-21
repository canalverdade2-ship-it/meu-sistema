import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const sshKey = "C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key";
const sshHost = "opc@147.15.43.141";

function runPsql(sql) {
  const res = spawnSync(
    'ssh',
    ['-i', sshKey, '-o', 'StrictHostKeyChecking=no', sshHost, 'PGPASSWORD=GSA_SENHA_FORTE_2026 psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -t -A'],
    { input: sql, maxBuffer: 50 * 1024 * 1024, encoding: 'utf8' }
  );
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(res.stderr || `Exit code ${res.status}`);
  return res.stdout;
}

// 1. Get all tables and columns
const tablesSql = `
SELECT json_agg(t) FROM (
  SELECT 
    c.table_name,
    c.column_name,
    c.data_type,
    c.udt_name,
    c.is_nullable,
    c.column_default
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  ORDER BY c.table_name, c.ordinal_position
) t;
`;

console.log('Querying tables & columns...');
const tablesData = runPsql(tablesSql);
fs.writeFileSync('.agents/teamwork_preview_explorer_db_1/vps_tables.json', tablesData, 'utf8');

// 2. Get all functions
const funcsSql = `
SELECT json_agg(f) FROM (
  SELECT 
    p.proname AS name,
    pg_get_function_identity_arguments(p.oid) AS identity_arguments,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS result_type,
    p.prosecdef AS is_security_definer,
    p.provolatile AS volatility,
    r.rolname AS owner,
    ARRAY(
      SELECT grantee || ':' || privilege_type 
      FROM information_schema.routine_privileges rp 
      WHERE rp.routine_schema = 'public' AND rp.routine_name = p.proname
    ) AS grants
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_roles r ON r.oid = p.proowner
  WHERE n.nspname = 'public'
  ORDER BY p.proname
) f;
`;

console.log('Querying functions...');
const funcsData = runPsql(funcsSql);
fs.writeFileSync('.agents/teamwork_preview_explorer_db_1/vps_functions.json', funcsData, 'utf8');

// 3. Get RLS policies
const rlsSql = `
SELECT json_agg(pol) FROM (
  SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname
) pol;
`;

console.log('Querying RLS policies...');
const rlsData = runPsql(rlsSql);
fs.writeFileSync('.agents/teamwork_preview_explorer_db_1/vps_rls.json', rlsData, 'utf8');

// 4. Get table RLS status & replica identity
const tableStatusSql = `
SELECT json_agg(ts) FROM (
  SELECT 
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced,
    c.relreplident AS replica_identity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY c.relname
) ts;
`;

console.log('Querying table status...');
const tableStatusData = runPsql(tableStatusSql);
fs.writeFileSync('.agents/teamwork_preview_explorer_db_1/vps_table_status.json', tableStatusData, 'utf8');

console.log('Metadata extraction complete!');
