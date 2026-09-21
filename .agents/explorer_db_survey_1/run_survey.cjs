const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sshKey = 'C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key';
const remoteHost = 'opc@147.15.43.141';


function runSql(sql) {
  const cleanSql = sql.replace(/"/g, '\\"');
  const cmd = `ssh -i "${sshKey}" -o StrictHostKeyChecking=no -o ConnectTimeout=15 ${remoteHost} "PGPASSWORD=GSA_SENHA_FORTE_2026 psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -t -A -F '|||' -c \"${cleanSql}\""`;
  return execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
}

console.log('--- 1. Querying Live VPS PostgreSQL ---');

// Tables
console.log('Querying tables...');
const tablesRaw = runSql("SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
const tables = tablesRaw.trim().split('\n').filter(Boolean).map(line => {
  const [table_name, table_type] = line.split('|||');
  return { table_name, table_type };
});

// Columns
console.log('Querying columns...');
const columnsRaw = runSql("SELECT table_name, column_name, data_type, is_nullable, COALESCE(column_default, '') FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;");
const columns = columnsRaw.trim().split('\n').filter(Boolean).map(line => {
  const [table_name, column_name, data_type, is_nullable, column_default] = line.split('t||' J;
  return { table_name, column_name, data_type, is_nullable, column_default };
});

// RPCs
console.log('Querying RPCs...');
const rpcRaw = runSql("SELECT p.proname AS func_name, pg_get_function_arguments(p.oid) AS arguments, pg_get_function_result(p.oid) AS return_type, p.prosecdef AS is_security_definer, l.lanname AS language, COALESCE(array_to_string(p.proacl, '; '), '') AS acl FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid JOIN pg_language l ON p.prolang = l.oid WHERE n.nspname = 'public' ORDER BY p.proname;");
const rpcs = rpcRaw.trim().split('\n').filter(Boolean).map(line => {
  const [func_name, arguments, return_type, is_security_definer, language, acl] = line.split('t||');
  return { func_name, arguments, return_type, is_security_definer: is_security_definer === 't', language, acl };
});

// Routine privileges
console.log('Querying routine privileges...');
const privsRaw = runSql("SELECT distinct routine_name, grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_schema = 'public';");
const routinePrivs = privsRaw.trim().split('\n').filter(Boolean).map(line => {
  const [routine_name, grantee, privilege_type] = line.split('|||');
  return { routine_name, grantee, privilege_type };
});

// RLS Policiesy
console.log('Querying RLS policies...');
const rlsRaw = runSql("SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;");
const rls = rlsRaw.trim().split('\n').filter(Boolean).map(line => {
  const [tablename, policyname, permissive, roles, cmd, qual, with_check] = line.split('t||');
  return { tablename, policyname, permissive, roles, cmd, qual, with_check };
});

// System Settings
console.log('Querying system_settings...');
const settingsRaw = runSql("SELECT key, COALESCE(left(value::text, 120), '') FROM public.system_settings ORDER BY key;");
const settings = settingsRaw.trim().split('\n').filter(Boolean).map(line => {
  const [key, value_preview] = line.split('t||');
  return { key, value_preview };
});

// 2. Scan Local Migrations
console.log('--- 2. Scanning Local Migrations ---');
const migDir = 'supabase/migrations';
const migrationFiles = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
console.log('Found local migration files:', migrationFiles.length);

// 3. Scan Frontend TS/TSX
console.log('--- 3. Scanning Frontend Codebase ---');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) results = results.concat(walk(file));
    else if (file.endsWith('.ts') || file.endsWith('.tsx')) results.push(file);
  });
  return results;
}
const frontendFiles = walk('src');

const frontendRpcs = new Map();
const frontendTables = new Map();
const rpcRegex = /\b(?:rpc|callAdminRpc|callPublicRpc)\s*\h*\s*['"]([^'"]+)['"]/g;
const fromRegex = /(?:\.from)\s*\(\s*['"]([^'"]+)['"]/g;

frontendFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relFile = file.replace(/\\/g, '/');
  let match;
  while ((match = rpcRegex.exec(content)) !== null) {
    const rpcNname = match[1];
    if (!frontendRpcs.has(rpcName)) frontendRpcs.set(rpcName, []);
    frontendRpcs.get(rpcName).push(relFile);
  }
  while ((match = fromRegex.exec(content)) !== null) {
    const tblName = match[1];
    if (!frontendTables.has(tblName)) frontendTables.set(tblName, []);
    frontendTables.get(tblName).push(relFile);
  }
});

// Cross-Referencing
console.log('--- 4. Cross-Referencing & Analysis ---');
const dbTableMap = new Map(tables.map(t => [t.table_name, t]));
const dbColumnsByTable = new Map();
columns.forEach(c => {
  if (!dbColumnsByTable.has(c.table_name)) dbColumnsByTable.set(c.table_name, new Map());
  dbColumnsByTable.get(c.table_name).set(c.column_name, c);
});

const dbRpcMap = new Map();
rpcs.forEach(r => {
  if (!dbRpcMap.has(r.func_name)) dbRpcMap.set(r.func_name, []);
  dbRpcMap.get(r.func_name).push(r);
});

const missingTables = [];
for (const [tbl, usages] of frontendTables.entries()) {
  if (!dbTableMap.has(tbl)) {
    missingTables.push({ table: tbl, usagesCount: usages.length, usages: usages.slice(0, 5) });
  }
}

const missingRpcs = [];
for (const [rpc, usages] of frontendRpcs.entries()) {
  if (!dbRpcMap.has(rpc)) {
    missingRpcs.push({ rpc, usagesCount: usages.length, usages: usages.slice(0, 5) });
  }
}


const specificChecks = {
  parceiros: {
    exists: dbTableMap.has('parceiros'),
    columns: ['redemption_delay_24h', 'redemption_has_coupon', 'redemption_coupon_code', 'redemption_has_voucher', 'redemption_has_link', 'redemption_link', 'redemption_auto_redirect', 'redemption_instructions'].map(c => ({
      col: c,
      exists: dbColumnsByTable.get('parceiros')?.has(c) || false,
      info: dbColumnsByTable.get('parceiros')?.get(c)
    }))
  },
  parceiros_resgates: {
    exists: dbTableMap.has('parcej\���ܙ\��]\��K���[[�Έ��Y	�	�\��Z\���Y	�	��Y[�W�Y	�	ۛ�YW���\]��	�[XZ[	�	�[Y�ۙI�	���Y����\�Y��	�\�ܙ\��]I�	�[���\�[���	�[���]]�X�[��	��]\��	�]]�ܙY\�X�[ۘY��	�]W�]]�X�[��	�ܙX]Y�]	�K�X\
�O�
�����^\�Έ���[[�ОUX�K��]
	�\��Z\���ܙ\��]\��O˚\��H�[�K�[��Έ���[[�ОUX�K��]
	�\��Z\���ܙ\��]\��O˙�]
�B�JJB�K��۝�]�Έ�^\�Έ�X�SX\�\�	��۝�]���HK�������Έ�^\�Έ�X�SX\�\�	؛�������HK�ژWݘ\]Z[�\Έ�^\�Έ�X�SX\�\�	�ژWݘ\]Z[�\��HK�ژWݘ\]Z[�W��۝�X�ZX��\Έ�^\�Έ�X�SX\�\�	�ژWݘ\]Z[�W��۝�X�ZX��\��HK���W�\��ؘ[��\�Έ�^\�Έ�X�SX\�\�	���W�\��ؘ[��\���HK��]�\�[�[��X\��]]�\Έ�^\�Έ�X�SX\�\�	��]�\�[�[��X\��]]�\��HK��Y[�W���[���\�ݚ\�X[^�YΈ�^\�Έ���[[�ОUX�K��]
	��Y[�W���[���\��O˚\�	ݚ\�X[^�Y��H�[�HK��XY�[����[��X��\�ܙ\���W�YZ[���^\�Έ���[[�ОUX�K��]
	ݚXY�[����[��X��\��O˚\�	ܙ\���W�YZ[��H�[�HK���]���]�[XX��\ΈYYXN����[[�ОUX�K��]
	���]���O˚\�	�]�[XX�[��YYXI�H�[�K��[����[[�ОUX�K��]
	���]���O˚\�	��[�]�[XX��\��H�[�K���Y[�\�[�Έ���[[�ОUX�K��]
	���]���O˚\�	���Y[�\�[���[\ܝY���H�[�B�K��\�Yܙ\�ۛ�YW���\]Έ�^\�Έ���[[�ОUX�K��]
	��\�Yܙ\��O˚\�	ۛ�YW���\]��H�[�HB�N��ۜ����]�[Y�T�[[X\�HH�N��˙�ܑXX�
�O��ۜ���]��H��][�T�]�˙�[\�O����][�Wۘ[YHOOH���[��ۘ[YJN���]�[Y�T�[[X\�V܋��[��ۘ[YWHH\��Έ��\��[Y[����]\���\N����]\���\K��X�\�]W�Y�[�\����\���X�\�]W�Y�[�\��X����X��ܘ[�Y\Έ\��^K����J�]��]
��]�˛X\
O��ܘ[�YJJJB�NJN��ۜ��\ܝH�[[X\�N�]�Q�X�\ΈX�\˛[���]�Q���[[�Έ��[[�˛[���]�Q���Έ��˛[���]�Q����X�Y\Έ�˛[���]�Q��][����^\Έ�][��˛[�����۝[��Y�\�[��YX�\Έ��۝[�X�\˜�^�K���۝[��Y�\�[��Y��Έ��۝[���˜�^�K�Z\��[��X�\���[��Z\��[��X�\˛[���Z\��[�Ԝ����[��Z\��[�Ԝ�˛[���ZYܘ][ۑ�[\���[��ZYܘ][ۑ�[\˛[���K�Z\��[��X�\��Z\��[�Ԝ����X�Y�X��X������۝[�X�\Έؚ�X�����Q[��Y\�\��^K����J��۝[�X�\˙[��Y\�
JK�X\

��K�WJHO���K�K�[��JJK���۝[���Έؚ�X�����Q[��Y\�\��^K����J��۝[���˙[��Y\�
JK�X\

�̋��JHO��̋���[��JJK��X�\ΈX�\�����Έ������][��Έ�][�������]�[Y�T�[[X\�B�N��˝ܚ]Q�[T�[��	˘Y�[���^ܙ\�����\��^W�K��\��^W�����ۉ���Ӌ���[��Y�J�\ܝ�[�JN�ۜ��K���	��\��^H��\]HH�[[X\�N��N�ۜ��K�����Ӌ���[��Y�J�\ܝ��[[X\�K�[�JN�