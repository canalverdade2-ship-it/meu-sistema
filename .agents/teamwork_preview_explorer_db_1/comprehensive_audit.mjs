import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const SSH_KEY = 'C:\\Users\\Adriano Farias\\Downloads\\CLOUD\\ssh-key-2026-07-30.key';
const SSH_HOST = 'opc@147.15.43.141';

function runRemotePsql(sql) {
  const fullCmd = `ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${SSH_HOST} "PGPASSWORD=GSA_SENHA_FORTE_2026 psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -t -A"`;
  return execSync(fullCmd, { input: sql, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
}

function runRemotePsqlJson(sql) {
  const cleanSql = sql.trim().replace(/;+$/, '');
  const wrappedSql = `SELECT COALESCE(json_agg(t), '[]'::json) FROM (${cleanSql}) t;`;
  const raw = runRemotePsql(wrappedSql);
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '') return [];
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    console.error('Failed to parse JSON result. Raw was:', trimmed.slice(0, 500));
    throw e;
  }
}

async function main() {
  console.log('=== STEP 1: Fetching Database Schema from Live PostgreSQL VPS ===');
  
  // 1.1 Tables
  const dbTables = runRemotePsqlJson(`
    SELECT table_name, table_type 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log(`Live DB Tables found: ${dbTables.length}`);

  // 1.2 Columns
  const dbColumns = runRemotePsqlJson(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    ORDER BY table_name, ordinal_position;
  `);
  console.log(`Live DB Columns found: ${dbColumns.length}`);

  // Build map: table -> Set of columns
  const dbTableColumnsMap = {};
  for (const col of dbColumns) {
    if (!dbTableColumnsMap[col.table_name]) {
      dbTableColumnsMap[col.table_name] = new Map();
    }
    dbTableColumnsMap[col.table_name].set(col.column_name, col);
  }

  // 1.3 Functions & RPCs
  const dbFunctions = runRemotePsqlJson(`
    SELECT 
      p.proname AS routine_name,
      pg_get_function_identity_arguments(p.oid) AS identity_arguments,
      pg_get_function_arguments(p.oid) AS arguments,
      pg_get_function_result(p.oid) AS result_type,
      p.prosecdef AS is_security_definer,
      p.provolatile AS volatility,
      p.proacl::text AS acl,
      d.description
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    LEFT JOIN pg_description d ON d.objoid = p.oid
    WHERE n.nspname = 'public'
    ORDER BY p.proname;
  `);
  console.log(`Live DB Functions/RPCs found: ${dbFunctions.length}`);

  // Build map of RPCs
  const dbFunctionMap = {};
  for (const f of dbFunctions) {
    if (!dbFunctionMap[f.routine_name]) {
      dbFunctionMap[f.routine_name] = [];
    }
    dbFunctionMap[f.routine_name].push(f);
  }

  // 1.4 System Settings
  const dbSystemSettings = runRemotePsqlJson(`
    SELECT key, value, description, created_at, updated_at
    FROM public.system_settings
    ORDER BY key;
  `);
  console.log(`Live DB System Settings found: ${dbSystemSettings.length} keys`);

  // 1.5 RLS and Policies
  const dbPolicies = runRemotePsqlJson(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);
  console.log(`Live DB RLS Policies found: ${dbPolicies.length}`);

  console.log('\n=== STEP 2: Scanning Codebase (src/) for DB References ===');
  
  const srcDir = path.resolve('src');
  const allSrcFiles = [];

  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js') || entry.name.endsWith('.jsx'))) {
        allSrcFiles.push(fullPath);
      }
    }
  }
  walkDir(srcDir);
  console.log(`Found ${allSrcFiles.length} source files in src/`);

  // Regex patterns
  // supabase.from('table_name') or supabase.from("table_name") or supabase.from(`table_name`)
  const fromRegex = /(?:supabase|client|adminClient|supabaseAdmin)\s*\.from\s*\(\s*['"`]([a-zA-Z0-9_\-]+)['"`]\s*\)/g;
  // supabase.rpc('function_name', { ... }) or callAdminRpc('function_name', { ... })
  const rpcRegex = /(?:supabase|client|adminClient|supabaseAdmin)\s*\.rpc\s*\(\s*['"`]([a-zA-Z0-9_\-]+)['"`]/g;
  const callAdminRpcRegex = /callAdminRpc\s*\(\s*['"`]([a-zA-Z0-9_\-]+)['"`]/g;
  const callRpcGenericRegex = /(?:invokeRpc|execRpc|runRpc|adminRpc)\s*\(\s*['"`]([a-zA-Z0-9_\-]+)['"`]/g;

  const tableUsages = new Map(); // tableName -> Array<{ file, line, code }>
  const rpcUsages = new Map(); // rpcName -> Array<{ file, line, caller, snippet }>
  const columnUsages = new Map(); // tableName -> Map<colName, Array<{ file, line }>>

  for (const filePath of allSrcFiles) {
    const relPath = path.relative(process.cwd(), filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match .from('...')
      let match;
      fromRegex.lastIndex = 0;
      while ((match = fromRegex.exec(line)) !== null) {
        const table = match[1];
        if (!tableUsages.has(table)) tableUsages.set(table, []);
        tableUsages.get(table).push({ file: relPath, line: i + 1, code: line.trim() });
      }

      // Match .rpc('...')
      rpcRegex.lastIndex = 0;
      while ((match = rpcRegex.exec(line)) !== null) {
        const rpc = match[1];
        if (!rpcUsages.has(rpc)) rpcUsages.set(rpc, []);
        rpcUsages.get(rpc).push({ file: relPath, line: i + 1, caller: 'supabase.rpc', snippet: line.trim() });
      }

      // Match callAdminRpc('...')
      callAdminRpcRegex.lastIndex = 0;
      while ((match = callAdminRpcRegex.exec(line)) !== null) {
        const rpc = match[1];
        if (!rpcUsages.has(rpc)) rpcUsages.set(rpc, []);
        rpcUsages.get(rpc).push({ file: relPath, line: i + 1, caller: 'callAdminRpc', snippet: line.trim() });
      }

      // Match callRpcGenericRegex
      callRpcGenericRegex.lastIndex = 0;
      while ((match = callRpcGenericRegex.exec(line)) !== null) {
        const rpc = match[1];
        if (!rpcUsages.has(rpc)) rpcUsages.set(rpc, []);
        rpcUsages.get(rpc).push({ file: relPath, line: i + 1, caller: 'genericRpc', snippet: line.trim() });
      }
    }
  }

  console.log(`Unique tables referenced in src/: ${tableUsages.size}`);
  console.log(`Unique RPCs referenced in src/: ${rpcUsages.size}`);

  console.log('\n=== STEP 3: Cross-Referencing Tables ===');
  const missingTables = [];
  const existingTables = [];
  for (const [tableName, usages] of tableUsages.entries()) {
    if (!dbTableColumnsMap[tableName]) {
      missingTables.push({ table: tableName, count: usages.length, usages });
    } else {
      existingTables.push(tableName);
    }
  }

  console.log(`Tables present in live DB: ${existingTables.length}`);
  console.log(`Tables MISSING in live DB: ${missingTables.length}`);
  if (missingTables.length > 0) {
    console.error('MISSING TABLES:');
    for (const m of missingTables) {
      console.error(`- ${m.table} (used in ${m.count} places, e.g. ${m.usages[0].file}:${m.usages[0].line})`);
    }
  }

  console.log('\n=== STEP 4: Cross-Referencing RPC Functions ===');
  const missingRpcs = [];
  const existingRpcs = [];
  for (const [rpcName, usages] of rpcUsages.entries()) {
    if (!dbFunctionMap[rpcName]) {
      missingRpcs.push({ rpc: rpcName, count: usages.length, usages });
    } else {
      existingRpcs.push({ rpc: rpcName, count: usages.length, defs: dbFunctionMap[rpcName], usages });
    }
  }

  console.log(`RPCs present in live DB: ${existingRpcs.length}`);
  console.log(`RPCs MISSING in live DB: ${missingRpcs.length}`);
  if (missingRpcs.length > 0) {
    console.error('MISSING RPCS:');
    for (const m of missingRpcs) {
      console.error(`- ${m.rpc} (called in ${m.count} places, e.g. ${m.usages[0].file}:${m.usages[0].line} [${m.usages[0].caller}])`);
    }
  }

  // Save intermediate results
  const auditData = {
    timestamp: new Date().toISOString(),
    liveDb: {
      tablesCount: dbTables.length,
      columnsCount: dbColumns.length,
      functionsCount: dbFunctions.length,
      systemSettingsCount: dbSystemSettings.length,
      policiesCount: dbPolicies.length,
      tables: dbTables.map(t => t.table_name),
      systemSettings: dbSystemSettings,
    },
    codebase: {
      sourceFilesCount: allSrcFiles.length,
      referencedTables: Array.from(tableUsages.keys()),
      referencedRpcs: Array.from(rpcUsages.keys()),
    },
    discrepancies: {
      missingTables,
      missingRpcs,
    },
    rpcDetails: existingRpcs.map(r => ({
      rpc: r.rpc,
      callers: Array.from(new Set(r.usages.map(u => u.caller))),
      usagesCount: r.count,
      overloads: r.defs.map(d => ({
        identity_arguments: d.identity_arguments,
        arguments: d.arguments,
        result_type: d.result_type,
        is_security_definer: d.is_security_definer,
        acl: d.acl
      }))
    }))
  };

  fs.writeFileSync('.agents/teamwork_preview_explorer_db_1/audit_raw.json', JSON.stringify(auditData, null, 2));
  console.log('Saved raw audit data to .agents/teamwork_preview_explorer_db_1/audit_raw.json');
}

main().catch(err => {
  console.error('Fatal Error during audit:', err);
  process.exit(1);
});
