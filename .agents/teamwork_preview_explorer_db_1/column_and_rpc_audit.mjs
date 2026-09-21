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

async function run() {
  console.log('=== 1. Fetching full DB Schema and Function Signatures ===');
  
  // 1.1 Public Tables
  const dbTables = runRemotePsqlJson(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `).map(t => t.table_name);
  const dbTableSet = new Set(dbTables);

  // 1.2 Columns with types
  const dbColumns = runRemotePsqlJson(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    ORDER BY table_name, ordinal_position;
  `);
  const dbTableCols = {};
  for (const c of dbColumns) {
    if (!dbTableCols[c.table_name]) dbTableCols[c.table_name] = new Set();
    dbTableCols[c.table_name].add(c.column_name);
  }

  // 1.3 Detailed Functions / RPCs with parameter names, types, defaults, security definer, permissions
  const dbProcs = runRemotePsqlJson(`
    SELECT 
      p.proname AS name,
      p.prosecdef AS is_security_definer,
      pg_get_function_identity_arguments(p.oid) AS identity_args,
      pg_get_function_arguments(p.oid) AS full_args,
      pg_get_function_result(p.oid) AS return_type,
      p.proacl::text AS acl,
      array_to_json(p.proargnames) AS arg_names,
      array_to_json(p.proargmodes) AS arg_modes,
      d.description
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    LEFT JOIN pg_description d ON d.objoid = p.oid
    WHERE n.nspname = 'public'
    ORDER BY p.proname;
  `);

  const procMap = new Map();
  for (const p of dbProcs) {
    if (!procMap.has(p.name)) procMap.set(p.name, []);
    procMap.get(p.name).push(p);
  }

  console.log(`Live DB: ${dbTables.length} tables, ${dbColumns.length} columns, ${dbProcs.length} procs (${procMap.size} distinct names).`);

  // 1.4 Parse src/ files
  console.log('\n=== 2. Parsing src/ codebase for queries and RPC calls ===');
  const srcDir = path.resolve('src');
  const allFiles = [];
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        allFiles.push(full);
      }
    }
  }
  walk(srcDir);

  const columnDiscrepancies = [];
  const rpcDiscrepancies = [];
  const tableDiscrepancies = [];
  const parsedRpcs = [];

  for (const file of allFiles) {
    const relFile = path.relative(process.cwd(), file);
    const content = fs.readFileSync(file, 'utf-8');

    // 1. Find .from('table').select('col1, col2, ...') or .insert({ ... }) or .update({ ... })
    // Use regex to find table references
    const fromMatches = content.matchAll(/(?:supabase|adminClient|supabaseAdmin|client)\s*\.from\s*\(\s*['"`]([a-zA-Z0-9_\-]+)['"`]\s*\)/g);
    for (const match of fromMatches) {
      const table = match[1];
      if (!dbTableSet.has(table)) {
        tableDiscrepancies.push({
          file: relFile,
          table,
          type: 'TABLE_NOT_FOUND_IN_DB'
        });
      }
    }

    // 2. Find .from('table').select('...') and inspect selected columns
    const selectMatches = content.matchAll(/(?:supabase|adminClient|supabaseAdmin|client)\s*\.from\s*\(\s*['"`]([a-zA-Z0-9_\-]+)['"`]\s*\)\s*\.select\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g);
    for (const sm of selectMatches) {
      const table = sm[1];
      const colsRaw = sm[2];
      if (dbTableCols[table]) {
        // Parse simple column names (exclude joins like foo(*), foo(col), count, aliases like col:other)
        const cols = colsRaw.split(',').map(c => c.trim()).filter(Boolean);
        for (const c of cols) {
          // simple identifier
          if (/^[a-zA-Z0-9_]+$/.test(c) && c !== '*') {
            if (!dbTableCols[table].has(c)) {
              columnDiscrepancies.push({
                file: relFile,
                table,
                column: c,
                type: 'SELECT_COLUMN_NOT_IN_DB',
                rawSelect: colsRaw
              });
            }
          }
        }
      }
    }

    // 3. Find .from('table').order('col')
    const orderMatches = content.matchAll(/(?:supabase|adminClient|supabaseAdmin|client)\s*\.from\s*\(\s*['"`]([a-zA-Z0-9_\-]+)['"`]\s*\)[^;]*?\.order\s*\(\s*['"`]([a-zA-Z0-9_]+)['"`]/gs);
    for (const om of orderMatches) {
      const table = om[1];
      const col = om[2];
      if (dbTableCols[table] && !dbTableCols[table].has(col)) {
        columnDiscrepancies.push({
          file: relFile,
          table,
          column: col,
          type: 'ORDER_COLUMN_NOT_IN_DB'
        });
      }
    }

    // 4. Find .from('table').eq('col', ...) or .neq or .gt or .lt
    const filterMatches = content.matchAll(/(?:supabase|adminClient|supabaseAdmin|client)\s*\.from\s*\(\s*['"`]([a-zA-Z0-9_\-]+)['"`]\s*\)[^;]*?\.(?:eq|neq|gt|gte|lt|lte|like|ilike|is|in)\s*\(\s*['"`]([a-zA-Z0-9_]+)['"`]/gs);
    for (const fm of filterMatches) {
      const table = fm[1];
      const col = fm[2];
      if (dbTableCols[table] && !dbTableCols[table].has(col)) {
        columnDiscrepancies.push({
          file: relFile,
          table,
          column: col,
          type: 'FILTER_COLUMN_NOT_IN_DB'
        });
      }
    }

    // 5. Find RPC calls: supabase.rpc('rpc_name', { args }) or callAdminRpc('rpc_name', { args })
    const rpcCallMatches = content.matchAll(/(?:(?:supabase|adminClient|supabaseAdmin|client)\s*\.rpc|callAdminRpc)\s*\(\s*['"`]([a-zA-Z0-9_\-]+)['"`](?:\s*,\s*(\{[\s\S]*?\}))?/g);
    for (const rm of rpcCallMatches) {
      const rpcName = rm[1];
      const argsRaw = rm[2];
      const isCallAdmin = rm[0].includes('callAdminRpc');
      const isAnonPublic = !isCallAdmin && (relFile.includes('/portal/') || relFile.includes('/public/') || relFile.includes('/pages/public/') || relFile.includes('Landing') || relFile.includes('Loja') || relFile.includes('Resgate') || relFile.includes('Parceiro') || relFile.includes('Afiliado') || relFile.includes('Careers') || relFile.includes('Checkout'));

      const dbDefs = procMap.get(rpcName);
      if (!dbDefs || dbDefs.length === 0) {
        rpcDiscrepancies.push({
          file: relFile,
          rpc: rpcName,
          type: 'RPC_NOT_IN_DB',
          callType: isCallAdmin ? 'callAdminRpc' : 'supabase.rpc'
        });
      } else {
        // Inspect definition & permissions
        for (const def of dbDefs) {
          const acl = def.acl || '';
          const hasAnon = acl.includes('anon=X') || acl.includes('=X/supabase_admin') || acl.includes('PUBLIC=X');
          const hasAuth = acl.includes('authenticated=X') || acl.includes('=X/supabase_admin') || acl.includes('PUBLIC=X');
          
          parsedRpcs.push({
            file: relFile,
            rpc: rpcName,
            callType: isCallAdmin ? 'callAdminRpc' : 'supabase.rpc',
            isSecurityDefiner: def.is_security_definer,
            acl: def.acl,
            fullArgs: def.full_args,
            argNames: def.arg_names,
            hasAnon,
            hasAuth,
            isAnonPublic
          });
        }
      }
    }
  }

  console.log(`\n=== DISCREPANCY SUMMARY ===`);
  console.log(`Table Discrepancies: ${tableDiscrepancies.length}`);
  console.log(`Column Discrepancies: ${columnDiscrepancies.length}`);
  console.log(`RPC Discrepancies: ${rpcDiscrepancies.length}`);

  // Unique table discrepancies
  const uniqueTableErrors = new Map();
  for (const td of tableDiscrepancies) {
    if (!uniqueTableErrors.has(td.table)) uniqueTableErrors.set(td.table, []);
    uniqueTableErrors.get(td.table).push(`${td.file}`);
  }
  console.log('\nUnique Missing Tables in DB:');
  for (const [t, files] of uniqueTableErrors.entries()) {
    console.log(`- ${t}: referenced in ${files.join(', ')}`);
  }

  // Unique column discrepancies
  const uniqueColErrors = new Map();
  for (const cd of columnDiscrepancies) {
    const key = `${cd.table}.${cd.column}`;
    if (!uniqueColErrors.has(key)) uniqueColErrors.set(key, []);
    uniqueColErrors.get(key).push(`${cd.file} (${cd.type})`);
  }
  console.log(`\nUnique Missing Columns in DB: ${uniqueColErrors.size}`);
  for (const [col, files] of uniqueColErrors.entries()) {
    console.log(`- ${col}: referenced in ${files.slice(0, 3).join(', ')}`);
  }

  // Check RPC permissions for public facing calls
  const publicRpcPermissionIssues = [];
  for (const pr of parsedRpcs) {
    if (pr.isAnonPublic && !pr.hasAnon) {
      publicRpcPermissionIssues.push(pr);
    }
  }
  console.log(`\nPublic RPCs potentially missing anon EXECUTE permission: ${publicRpcPermissionIssues.length}`);
  for (const p of publicRpcPermissionIssues) {
    console.log(`- ${p.rpc} called in ${p.file} (acl: ${p.acl})`);
  }

  fs.writeFileSync('.agents/teamwork_preview_explorer_db_1/audit_discrepancies.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    tableDiscrepancies: Array.from(uniqueTableErrors.entries()).map(([table, files]) => ({ table, files })),
    columnDiscrepancies: Array.from(uniqueColErrors.entries()).map(([col, files]) => ({ col, files })),
    rpcDiscrepancies,
    publicRpcPermissionIssues
  }, null, 2));

  console.log('\nSaved discrepancy report to .agents/teamwork_preview_explorer_db_1/audit_discrepancies.json');
}

run().catch(console.error);
