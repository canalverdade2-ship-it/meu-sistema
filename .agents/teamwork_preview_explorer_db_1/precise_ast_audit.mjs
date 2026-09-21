import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

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

// 1. Fetch DB Metadata
console.log('Fetching live DB metadata...');
const dbTables = runRemotePsqlJson(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public'
  ORDER BY table_name;
`).map(t => t.table_name);
const dbTableSet = new Set(dbTables);

const dbColumns = runRemotePsqlJson(`
  SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default 
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
  ORDER BY table_name, ordinal_position;
`);
const dbTableCols = new Map();
for (const c of dbColumns) {
  if (!dbTableCols.has(c.table_name)) dbTableCols.set(c.table_name, new Map());
  dbTableCols.get(c.table_name).set(c.column_name, c);
}

const dbProcs = runRemotePsqlJson(`
  SELECT 
    p.proname AS name,
    p.prosecdef AS is_security_definer,
    pg_get_function_identity_arguments(p.oid) AS identity_args,
    pg_get_function_arguments(p.oid) AS full_args,
    pg_get_function_result(p.oid) AS return_type,
    p.proacl::text AS acl,
    array_to_json(p.proargnames) AS arg_names,
    array_to_json(p.proargmodes) AS arg_modes
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  ORDER BY p.proname;
`);
const dbProcMap = new Map();
for (const p of dbProcs) {
  if (!dbProcMap.has(p.name)) dbProcMap.set(p.name, []);
  dbProcMap.get(p.name).push(p);
}

console.log(`Live DB Metadata: ${dbTables.length} tables, ${dbColumns.length} columns, ${dbProcs.length} procs loaded.`);

// 2. Parse PostgREST select string
// Handles: id, nome, status, faturas(id, valor), indicador:indicador_id(nome), count, etc.
function parseSelectColumns(selectStr) {
  const topLevelCols = [];
  const embedded = [];
  let depth = 0;
  let currentToken = '';
  let insideRelation = false;
  let relationName = '';
  let relationContent = '';

  for (let i = 0; i < selectStr.length; i++) {
    const char = selectStr[i];
    if (char === '(') {
      if (depth === 0) {
        insideRelation = true;
        relationName = currentToken.trim();
        currentToken = '';
      } else {
        relationContent += char;
      }
      depth++;
    } else if (char === ')') {
      depth--;
      if (depth === 0) {
        insideRelation = false;
        embedded.push({ relation: relationName, select: relationContent });
        relationName = '';
        relationContent = '';
        currentToken = '';
      } else {
        relationContent += char;
      }
    } else if (char === ',' && depth === 0) {
      const col = currentToken.trim();
      if (col) topLevelCols.push(col);
      currentToken = '';
    } else {
      if (depth > 0) {
        relationContent += char;
      } else {
        currentToken += char;
      }
    }
  }
  const lastCol = currentToken.trim();
  if (lastCol) topLevelCols.push(lastCol);

  // Clean aliases like "nome:custom_name" -> get actual DB column
  const cleanTopLevel = topLevelCols.map(c => {
    if (c.includes(':')) {
      const parts = c.split(':');
      return parts[parts.length - 1].trim();
    }
    return c;
  }).filter(c => c && c !== '*' && !c.startsWith('!inner'));

  return { columns: cleanTopLevel, embedded };
}

// 3. Scan all TypeScript source files in src/
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

const discrepancies = {
  missingTables: [],
  missingColumns: [],
  missingRpcs: [],
  rpcArgumentIssues: [],
  rpcPermissionIssues: [],
};

for (const filePath of allFiles) {
  const relFile = path.relative(process.cwd(), filePath);
  const code = fs.readFileSync(filePath, 'utf-8');

  let sourceFile;
  try {
    sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
  } catch (e) {
    console.error(`Failed to parse TS file: ${relFile}`, e);
    continue;
  }

  function visit(node) {
    // 1. Match CallExpression: supabase.from('...'), supabase.rpc('...'), callAdminRpc('...')
    if (ts.isCallExpression(node)) {
      const expr = node.expression;

      // Check for callAdminRpc('rpcName', { args })
      if (ts.isIdentifier(expr) && expr.text === 'callAdminRpc') {
        if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
          const rpcName = node.arguments[0].text;
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          checkRpcCall(rpcName, node.arguments[1], relFile, pos.line + 1, 'callAdminRpc');
        }
      }

      // Check for property access: obj.from(...) or obj.rpc(...)
      if (ts.isPropertyAccessExpression(expr)) {
        const methodName = expr.name.text;

        // obj.rpc('rpcName', { args })
        if (methodName === 'rpc') {
          if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
            const rpcName = node.arguments[0].text;
            const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            checkRpcCall(rpcName, node.arguments[1], relFile, pos.line + 1, 'supabase.rpc');
          }
        }

        // obj.from('tableName')
        if (methodName === 'from') {
          if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
            const tableName = node.arguments[0].text;
            const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            checkTableCall(node, tableName, relFile, pos.line + 1);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  function checkTableCall(fromCallNode, tableName, file, line) {
    if (!dbTableSet.has(tableName)) {
      discrepancies.missingTables.push({
        table: tableName,
        file,
        line
      });
      return;
    }

    // Traverse the chain upwards to find chained .select, .insert, .update, .order, .eq, etc.
    let parent = fromCallNode.parent;
    while (parent && (ts.isPropertyAccessExpression(parent) || ts.isCallExpression(parent))) {
      if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression)) {
        const method = parent.expression.name.text;
        const callLine = sourceFile.getLineAndCharacterOfPosition(parent.getStart()).line + 1;

        if (method === 'select' && parent.arguments.length > 0 && ts.isStringLiteral(parent.arguments[0])) {
          const selectStr = parent.arguments[0].text;
          const { columns, embedded } = parseSelectColumns(selectStr);
          for (const col of columns) {
            if (col && !dbTableCols.get(tableName)?.has(col)) {
              discrepancies.missingColumns.push({
                table: tableName,
                column: col,
                type: 'SELECT',
                file,
                line: callLine,
                selectStr
              });
            }
          }
          // Validate embedded relations if simple table
          for (const emb of embedded) {
            let relTable = emb.relation;
            if (relTable.includes(':')) {
              // alias:real_table
              const parts = relTable.split(':');
              relTable = parts[parts.length - 1].trim();
            }
            if (dbTableSet.has(relTable)) {
              const embParsed = parseSelectColumns(emb.select);
              for (const col of embParsed.columns) {
                if (col && !dbTableCols.get(relTable)?.has(col)) {
                  discrepancies.missingColumns.push({
                    table: relTable,
                    column: col,
                    type: 'EMBEDDED_SELECT',
                    parentTable: tableName,
                    file,
                    line: callLine,
                    selectStr: emb.select
                  });
                }
              }
            }
          }
        }

        if (method === 'order' && parent.arguments.length > 0 && ts.isStringLiteral(parent.arguments[0])) {
          const orderCol = parent.arguments[0].text;
          if (orderCol && !dbTableCols.get(tableName)?.has(orderCol)) {
            discrepancies.missingColumns.push({
              table: tableName,
              column: orderCol,
              type: 'ORDER',
              file,
              line: callLine
            });
          }
        }

        if (['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in'].includes(method)) {
          if (parent.arguments.length > 0 && ts.isStringLiteral(parent.arguments[0])) {
            const filterCol = parent.arguments[0].text;
            if (filterCol && !dbTableCols.get(tableName)?.has(filterCol)) {
              discrepancies.missingColumns.push({
                table: tableName,
                column: filterCol,
                type: 'FILTER_' + method.toUpperCase(),
                file,
                line: callLine
              });
            }
          }
        }
      }
      parent = parent.parent;
    }
  }

  function checkRpcCall(rpcName, argsNode, file, line, callType) {
    const dbDefs = dbProcMap.get(rpcName);
    if (!dbDefs || dbDefs.length === 0) {
      discrepancies.missingRpcs.push({
        rpc: rpcName,
        callType,
        file,
        line
      });
      return;
    }

    // Inspect passed arguments object if literal
    let passedArgKeys = [];
    if (argsNode && ts.isObjectLiteralExpression(argsNode)) {
      for (const prop of argsNode.properties) {
        if (ts.isPropertyAssignment(prop) && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))) {
          passedArgKeys.push(prop.name.text);
        } else if (ts.isShorthandPropertyAssignment(prop)) {
          passedArgKeys.push(prop.name.text);
        }
      }
    }

    // Check against DB defs
    for (const def of dbDefs) {
      const acl = def.acl || '';
      const hasAnon = acl.includes('anon=X') || acl.includes('=X/supabase_admin') || acl.includes('PUBLIC=X');
      const hasAuth = acl.includes('authenticated=X') || acl.includes('=X/supabase_admin') || acl.includes('PUBLIC=X');
      
      const isPublicArea = file.includes('/public/') || file.includes('/pages/public/') || file.includes('Landing') || file.includes('Resgate') || file.includes('Parceiro') || file.includes('Afiliado');

      if (callType === 'supabase.rpc' && isPublicArea && !hasAnon) {
        discrepancies.rpcPermissionIssues.push({
          rpc: rpcName,
          file,
          line,
          callType,
          acl,
          reason: 'Public facing call to RPC without explicit anon EXECUTE grant'
        });
      }

      if (passedArgKeys.length > 0 && def.arg_names && Array.isArray(def.arg_names)) {
        // Check if any passed argument does not exist in function parameters
        const funcParamNames = new Set(def.arg_names);
        // Note: single JSON/jsonb parameter function takes payload object
        if (def.arg_names.length === 1 && (def.full_args.includes('json') || def.full_args.includes('jsonb'))) {
          // json payload argument, any object is valid
        } else {
          for (const key of passedArgKeys) {
            if (!funcParamNames.has(key)) {
              discrepancies.rpcArgumentIssues.push({
                rpc: rpcName,
                passedKey: key,
                funcParams: def.arg_names,
                file,
                line
              });
            }
          }
        }
      }
    }
  }

  visit(sourceFile);
}

// 4. Summarize Discrepancies
console.log('\n=== AST AUDIT COMPLETED ===');

// Dedup missing tables
const uniqueMissingTables = new Map();
for (const t of discrepancies.missingTables) {
  if (!uniqueMissingTables.has(t.table)) uniqueMissingTables.set(t.table, []);
  uniqueMissingTables.get(t.table).push(`${t.file}:${t.line}`);
}
console.log(`\n1. MISSING TABLES (${uniqueMissingTables.size}):`);
for (const [table, locations] of uniqueMissingTables.entries()) {
  console.log(`❌ Table "${table}" referenced in:`);
  for (const loc of locations) console.log(`   - ${loc}`);
}

// Dedup missing columns
const uniqueMissingCols = new Map();
for (const c of discrepancies.missingColumns) {
  const key = `${c.table}.${c.column}`;
  if (!uniqueMissingCols.has(key)) uniqueMissingCols.set(key, { table: c.table, col: c.column, type: c.type, locations: [] });
  uniqueMissingCols.get(key).locations.push(`${c.file}:${c.line} (${c.type})`);
}
console.log(`\n2. MISSING COLUMNS (${uniqueMissingCols.size}):`);
for (const [key, info] of uniqueMissingCols.entries()) {
  console.log(`❌ Column "${key}" (${info.type}) referenced in:`);
  for (const loc of info.locations) console.log(`   - ${loc}`);
}

// Dedup missing RPCs
const uniqueMissingRpcs = new Map();
for (const r of discrepancies.missingRpcs) {
  if (!uniqueMissingRpcs.has(r.rpc)) uniqueMissingRpcs.set(r.rpc, []);
  uniqueMissingRpcs.get(r.rpc).push(`${r.file}:${r.line} [${r.callType}]`);
}
console.log(`\n3. MISSING RPCS (${uniqueMissingRpcs.size}):`);
for (const [rpc, locations] of uniqueMissingRpcs.entries()) {
  console.log(`❌ RPC "${rpc}" called in:`);
  for (const loc of locations) console.log(`   - ${loc}`);
}

// Dedup RPC Argument Issues
const uniqueRpcArgIssues = new Map();
for (const a of discrepancies.rpcArgumentIssues) {
  const key = `${a.rpc}.${a.passedKey}`;
  if (!uniqueRpcArgIssues.has(key)) uniqueRpcArgIssues.set(key, { ...a, locations: [] });
  uniqueRpcArgIssues.get(key).locations.push(`${a.file}:${a.line}`);
}
console.log(`\n4. RPC PARAMETER MISMATCHES (${uniqueRpcArgIssues.size}):`);
for (const [key, info] of uniqueRpcArgIssues.entries()) {
  console.log(`⚠️ Parameter "${info.passedKey}" passed to RPC "${info.rpc}" (DB params: [${info.funcParams.join(', ')}]) in:`);
  for (const loc of info.locations) console.log(`   - ${loc}`);
}

// Dedup RPC Permission Issues
const uniquePermIssues = new Map();
for (const p of discrepancies.rpcPermissionIssues) {
  if (!uniquePermIssues.has(p.rpc)) uniquePermIssues.set(p.rpc, { ...p, locations: [] });
  uniquePermIssues.get(p.rpc).locations.push(`${p.file}:${p.line}`);
}
console.log(`\n5. RPC PERMISSION ISSUES (${uniquePermIssues.size}):`);
for (const [rpc, info] of uniquePermIssues.entries()) {
  console.log(`⚠️ RPC "${rpc}" public access without anon grant:`);
  for (const loc of info.locations) console.log(`   - ${loc}`);
}

fs.writeFileSync('.agents/teamwork_preview_explorer_db_1/precise_audit_results.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  missingTables: Array.from(uniqueMissingTables.entries()).map(([table, locations]) => ({ table, locations })),
  missingColumns: Array.from(uniqueMissingCols.entries()).map(([key, info]) => ({ key, ...info })),
  missingRpcs: Array.from(uniqueMissingRpcs.entries()).map(([rpc, locations]) => ({ rpc, locations })),
  rpcArgumentIssues: Array.from(uniqueRpcArgIssues.entries()).map(([key, info]) => ({ key, ...info })),
  rpcPermissionIssues: Array.from(uniquePermIssues.entries()).map(([rpc, info]) => ({ rpc, ...info }))
}, null, 2));

console.log('\nSaved precise AST audit results to .agents/teamwork_preview_explorer_db_1/precise_audit_results.json');
