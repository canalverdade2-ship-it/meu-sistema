const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sshKey = 'C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key';
const remoteHost = 'opc@147.15.43.141';

function runSql(sql) {
  const cleanSql = sql.replace(/"/g, '\\"');
  const cmd = `ssh -i "${sshKey}" -o StrictHostKeyChecking=no -o ConnectTimeout=15 ${remoteHost} "PGPASSWORD=GSA_SENHA_FORTE_2026 psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -t -A -F '|||' -c \\"${cleanSql}\\""`;
  return execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
}

console.log('--- 1. Querying Live VPS PostgreSQL ---');

console.log('Querying tables...');
const tablesRaw = runSql("SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
const tables = tablesRaw.trim().split('\n').filter(Boolean).map(line => {
  const [table_name, table_type] = line.split('|||');
  return { table_name, table_type };
});

console.log('Querying columns...');
const columnsRaw = runSql("SELECT table_name, column_name, data_type, is_nullable, COALESCE(column_default, '') FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;");
const columns = columnsRaw.trim().split('\n').filter(Boolean).map(line => {
  const [table_name, column_name, data_type, is_nullable, column_default] = line.split('|||');
  return { table_name, column_name, data_type, is_nullable, column_default };
});

console.log('Querying RPCs...');
const rpcRaw = runSql("SELECT p.proname AS func_name, pg_get_function_arguments(p.oid) AS arguments, pg_get_function_result(p.oid) AS return_type, p.prosecdef AS is_security_definer, l.lanname AS language, COALESCE(array_to_string(p.proacl, '; '), '') AS acl FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid JOIN pg_language l ON p.prolang = l.oid WHERE n.nspname = 'public' ORDER BY p.proname;");
const rpcs = rpcRaw.trim().split('\n').filter(Boolean).map(line => {
  const [func_name, arguments, return_type, is_security_definer, language, acl] = line.split('|||');
  return { func_name, arguments, return_type, is_security_definer: is_security_definer === 't', language, acl };
});

console.log('Querying routine privileges...');
const privsRaw = runSql("SELECT DISTINCT routine_name, grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_schema = 'public';");
const routinePrivs = privsRaw.trim().split('\n').filter(Boolean).map(line => {
  const [routine_name, grantee, privilege_type] = line.split('|||');
  return { routine_name, grantee, privilege_type };
});

console.log('Querying RLS policies...');
const rlsRaw = runSql("SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;");
const rls = rlsRaw.trim().split('\n').filter(Boolean).map(line => {
  const [tablename, policyname, permissive, roles, cmd, qual, with_check] = line.split('|||');
  return { tablename, policyname, permissive, roles, cmd, qual, with_check };
});

console.log('Querying system_settings...');
const settingsRaw = runSql("SELECT key, COALESCE(left(value::text, 120), '') FROM public.system_settings ORDER BY key;");
const settings = settingsRaw.trim().split('\n').filter(Boolean).map(line => {
  const [key, value_preview] = line.split('|||');
  return { key, value_preview };
});

console.log('--- 2. Scanning Local Migrations ---');
const migDir = 'supabase/migrations';
const migrationFiles = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
console.log('Found local migration files:', migrationFiles.length);

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
const rpcRegex = /\b(?:rpc|callAdminRpc|callPublicRpc)\s*\(\s*['"]([^'"]+)['"]/g;
const fromRegex = /(?:\.from)\s*\(\s*['"]([^'"]+)['"]/g;

frontendFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relFile = file.replace(/\\/g, '/');
  let match;
  while ((match = rpcRegex.exec(content)) !== null) {
    const rpcName = match[1];
    if (!frontendRpcs.has(rpcName)) frontendRpcs.set(rpcName, []);
    frontendRpcs.get(rpcName).push(relFile);
  }
  while ((match = fromRegex.exec(content)) !== null) {
    const tblName = match[1];
    if (!frontendTables.has(tblName)) frontendTables.set(tblName, []);
    frontendTables.get(tblName).push(relFile);
  }
});

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
    exists: dbTableMap.has('parceiros_resgates'),
    columns: ['id', 'parceiro_id', 'cliente_id', 'nome_completo', 'email', 'telefone', 'codigo_gerado', 'tipo_resgate', 'link_destino', 'link_ativacao', 'status', 'auto_redirecionado', 'data_ativacao', 'created_at'].map(c => ({
      col: c,
      exists: dbColumnsByTable.get('parceiros_resgates')?.has(c) || false,
      info: dbColumnsByTable.get('parceiros_resgates')?.get(c)
    }))
  },
  contratos: { exists: dbTableMap.has('contratos') },
  blog_posts: { exists: dbTableMap.has('blog_posts') },
  loja_vaquinhas: { exists: dbTableMap.has('loja_vaquinhas') },
  loja_vaquinha_contribuicoes: { exists: dbTableMap.has('loja_vaquinha_contribuicoes') },
  gsa_hero_banners: { exists: dbTableMap.has('gsa_hero_banners') },
  whatsapp_pendencias_ativas: { exists: dbTableMap.has('whatsapp_pendencias_ativas') },
  cliente_promocoes_visualizado: { exists: dbColumnsByTable.get('cliente_promocoes')?.has('visualizado') || false },
  viagens_transacoes_resposta_admin: { exists: dbColumnsByTable.get('viagens_transacoes')?.has('resposta_admin') || false },
  produtos_avaliacoes: {
    media: dbColumnsByTable.get('produtos')?.has('avaliacao_media') || false,
    total: dbColumnsByTable.get('produtos')?.has('total_avaliacoes') || false,
    comentarios: dbColumnsByTable.get('produtos')?.has('comentarios_importados') || false
  },
  prestadores_nome_completo: { exists: dbColumnsByTable.get('prestadores')?.has('nome_completo') || false }
};

const rpcPrivilegeSummary = {};
rpcs.forEach(r => {
  const rPrivs = routinePrivs.filter(p => p.routine_name === r.func_name);
  rpcPrivilegeSummary[r.func_name] = {
    args: r.arguments,
    return_type: r.return_type,
    security_definer: r.is_security_definer,
    acl: r.acl,
    grantees: Array.from(new Set(rPrivs.map(p => p.grantee)))
  };
});

const report = {
  summary: {
    liveDbTables: tables.length,
    liveDbColumns: columns.length,
    liveDbRpcs: rpcs.length,
    liveDbRlsPolicies: rls.length,
    liveDbSettingsKeys: settings.length,
    frontendReferencedTables: frontendTables.size,
    frontendReferencedRpcs: frontendRpcs.size,
    missingTablesCount: missingTables.length,
    missingRpcsCount: missingRpcs.length,
    migrationFilesCount: migrationFiles.length
  },
  missingTables,
  missingRpcs,
  specificChecks,
  frontendTables: Object.fromEntries(Array.from(frontendTables.entries()).map(([k, v]) => [k, v.length])),
  frontendRpcs: Object.fromEntries(Array.from(frontendRpcs.entries()).map(([k, v]) => [k, v.length])),
  dbTables: tables,
  dbRpcs: rpcs,
  dbSettings: settings,
  rpcPrivilegeSummary
};

fs.writeFileSync('.agents/explorer_db_survey_1/survey_db.json', JSON.stringify(report, null, 2));

console.log('--- MISSING TABLES DETAIL ---');
console.log(JSON.stringify(report.missingTables, null, 2));

console.log('\n--- SPECIFIC CHECKS DETAIL ---');
console.log(JSON.stringify(report.specificChecks, null, 2));

console.log('\n--- SYSTEM SETTINGS KEYS (' + report.dbSettings.length + ') ---');
report.dbSettings.forEach(s => console.log(`  - ${s.key}: ${s.value_preview}`));