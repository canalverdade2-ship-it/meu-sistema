const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sshKey = 'C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key';
const remoteHost = 'opc@147.15.43.141';

function runSql(sql) {
  const cleanSql = sql.replace(/\r?\n/g, ' ').replace(/"/g, '\\"');
  const cmd = `ssh -i "${sshKey}" -o StrictHostKeyChecking=no -o ConnectTimeout=15 ${remoteHost} "PGPASSWORD=GSA_SENHA_FORTE_2026 psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -t -A -F '|||' -c \\"${cleanSql}\\""`;
  return execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
}

console.log('--- 1. Fetching all DB columns and tables ---');
const colRaw = runSql("SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public';");
const dbTableColumns = new Map();
colRaw.trim().split('\n').filter(Boolean).forEach(line => {
  const [table, col, type, nullable] = line.split('|||');
  if (!dbTableColumns.has(table)) dbTableColumns.set(table, new Map());
  dbTableColumns.get(table).set(col, { type, nullable });
});

console.log(`Loaded ${dbTableColumns.size} tables with columns from live DB.`);

console.log('--- 2. Fetching all DB RPC definitions and security ---');
const rpcRaw = runSql(`
SELECT 
  p.proname,
  pg_get_function_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS ret,
  p.prosecdef,
  COALESCE(array_to_string(p.proacl, '; '), '') AS acl
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public';
`);
const dbRpcs = new Map();
rpcRaw.trim().split('\n').filter(Boolean).forEach(line => {
  const [name, args, ret, secdef, acl] = line.split('|||');
  if (!dbRpcs.has(name)) dbRpcs.set(name, []);
  dbRpcs.get(name).push({ args, ret, secdef: secdef === 't', acl });
});

console.log(`Loaded ${dbRpcs.size} unique RPC names from live DB.`);

// Scan all TS/TSX files
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

const files = walk('src');
console.log(`Scanning ${files.length} source files for column references...`);

const columnErrors = [];
const rpcAudit = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = file.replace(/\\/g, '/');

  // Enhanced select parser that extracts only the first argument string
  const selectRegex = /\.from\s*\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)\s*\.select\s*\(\s*(['"`])([\s\S]*?)\2/g;
  let match;
  while ((match = selectRegex.exec(content)) !== null) {
    const table = match[1];
    const rawSelect = match[3];

    if (table.startsWith('gsa-') || table.includes('storage') || table === 'documentos_cliente' || table === 'documentos_prestador') continue;
    if (!dbTableColumns.has(table)) continue;

    // Tokenize top-level fields vs nested relations
    let parenDepth = 0;
    let currentToken = '';
    let currentRelation = null;
    let relationFields = '';

    for (let i = 0; i < rawSelect.length; i++) {
      const char = rawSelect[i];
      if (char === '(') {
        if (parenDepth === 0) {
          currentRelation = currentToken.trim().split(':').pop().split('!')[0].trim();
          relationFields = '';
        } else {
          relationFields += char;
        }
        parenDepth++;
      } else if (char === ')') {
        parenDepth--;
        if (parenDepth === 0) {
          // Check embedded relation
          if (currentRelation && dbTableColumns.has(currentRelation)) {
            const relCols = dbTableColumns.get(currentRelation);
            relationFields.split(',').map(f => f.trim().split(':')[0].trim()).forEach(rf => {
              if (rf && rf !== '*' && !rf.includes('(') && !relCols.has(rf)) {
                columnErrors.push({
                  file: relPath,
                  table: currentRelation,
                  column: rf,
                  type: 'NESTED_RELATION_MISSING_COLUMN',
                  snippet: `${table} -> ${currentRelation}.${rf}`
                });
              }
            });
          }
          currentRelation = null;
          currentToken = '';
        } else {
          relationFields += char;
        }
      } else if (char === ',' && parenDepth === 0) {
        const topField = currentToken.trim().split(':')[0].trim();
        if (topField && topField !== '*' && !topField.includes('(') && !topField.includes('->') && !topField.includes('!')) {
          const tableCols = dbTableColumns.get(table);
          if (tableCols && !tableCols.has(topField)) {
            columnErrors.push({
              file: relPath,
              table,
              column: topField,
              type: 'SELECT_MISSING_COLUMN',
              snippet: `${table}.${topField} in ${match[0].slice(0, 60)}`
            });
          }
        }
        currentToken = '';
      } else {
        if (parenDepth > 0) {
          relationFields += char;
        } else {
          currentToken += char;
        }
      }
    }

    // Trailing token
    const lastTopField = currentToken.trim().split(':')[0].trim();
    if (lastTopField && lastTopField !== '*' && !lastTopField.includes('(') && !lastTopField.includes('->') && !lastTopField.includes('!')) {
      const tableCols = dbTableColumns.get(table);
      if (tableCols && !tableCols.has(lastTopField)) {
        columnErrors.push({
          file: relPath,
          table,
          column: lastTopField,
          type: 'SELECT_MISSING_COLUMN',
          snippet: `${table}.${lastTopField} in ${match[0].slice(0, 60)}`
        });
      }
    }
  }

  // Find patterns like: .eq('column', ...) / .order('column')
  const colOpRegex = /\.from\s*\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)[^;]*?\.(?:eq|neq|gt|gte|lt|lte|like|ilike|order)\s*\(\s*['"]([a-zA-Z0-9_-]+)['"]/g;
  while ((match = colOpRegex.exec(content)) !== null) {
    const table = match[1];
    const col = match[2];
    if (dbTableColumns.has(table)) {
      const tableCols = dbTableColumns.get(table);
      if (!tableCols.has(col)) {
        columnErrors.push({
          file: relPath,
          table,
          column: col,
          type: 'FILTER_ORDER_MISSING_COLUMN',
          snippet: match[0].slice(0, 80)
        });
      }
    }
  }

  // Check RPC calls
  const rpcRegex = /\b(?:rpc|callAdminRpc|callPublicRpc)\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = rpcRegex.exec(content)) !== null) {
    const rpcName = match[1];
    const rpcExists = dbRpcs.has(rpcName);
    const rpcDefs = dbRpcs.get(rpcName) || [];
    rpcAudit.push({
      file: relPath,
      rpc: rpcName,
      exists: rpcExists,
      overloads: rpcDefs.length,
      signatures: rpcDefs.map(d => ({ args: d.args, ret: d.ret, secdef: d.secdef, acl: d.acl }))
    });
  }
});

// Deduplicate column errors
const uniqueColumnErrors = [];
const seenColErr = new Set();
columnErrors.forEach(err => {
  const key = `${err.table}.${err.column}@${err.file}`;
  if (!seenColErr.has(key)) {
    seenColErr.add(key);
    uniqueColumnErrors.push(err);
  }
});

// Deduplicate RPC calls
const uniqueRpcs = new Map();
rpcAudit.forEach(r => {
  if (!uniqueRpcs.has(r.rpc)) {
    uniqueRpcs.set(r.rpc, {
      rpc: r.rpc,
      exists: r.exists,
      signatures: r.signatures,
      callers: []
    });
  }
  if (!uniqueRpcs.get(r.rpc).callers.includes(r.file)) {
    uniqueRpcs.get(r.rpc).callers.push(r.file);
  }
});

// Check permissions on all RPCs
const rpcPermissionReport = [];
for (const [name, info] of uniqueRpcs.entries()) {
  let isPublic = name.startsWith('gsa_public_') || name.startsWith('rpc_');
  let isAdmin = name.startsWith('gsa_admin_');
  let hasAnon = false;
  let hasAuth = false;
  let hasService = false;

  info.signatures.forEach(sig => {
    const acl = sig.acl;
    if (acl.includes('anon=') || acl.includes('=X/') || acl === '') hasAnon = true; // default public execute if acl empty
    if (acl.includes('authenticated=') || acl.includes('=X/') || acl === '') hasAuth = true;
    if (acl.includes('service_role=') || acl.includes('=X/') || acl === '') hasService = true;
  });

  rpcPermissionReport.push({
    rpc: name,
    exists: info.exists,
    signatures: info.signatures,
    callersCount: info.callers.length,
    callers: info.callers.slice(0, 3),
    isPublic,
    isAdmin,
    hasAnon,
    hasAuth,
    hasService
  });
}

const auditResult = {
  totalUniqueColumnErrors: uniqueColumnErrors.length,
  columnErrors: uniqueColumnErrors,
  totalUniqueRpcsScanned: uniqueRpcs.size,
  missingRpcs: Array.from(uniqueRpcs.values()).filter(r => !r.exists),
  rpcPermissionReport
};

fs.writeFileSync('.agents/explorer_db_survey_1/deep_audit_result.json', JSON.stringify(auditResult, null, 2));

console.log('\n--- CRITICAL RPCs DEFINITION & PERMISSIONS ---');
const targetRpcs = [
  'gsa_public_resgatar_beneficio_parceiro',
  'gsa_admin_complete_partner_redemption',
  'gsa_admin_approve_budget',
  'gsa_admin_process_travel_refund',
  'gsa_criar_vaquinha',
  'gsa_obter_vaquinha',
  'gsa_confirmar_contribuicao_vaquinha',
  'gsa_registrar_pendencia_whatsapp',
  'gsa_public_register_client',
  'gsa_public_register_provider',
  'gsa_public_register_supplier',
  'gsa_validate_session',
  'gsa_ping_session',
  'gsa_end_session',
  'gsa_client_operational_write'
];

targetRpcs.forEach(name => {
  console.log(`\n=== RPC: ${name} ===`);
  const defs = dbRpcs.get(name);
  if (!defs) {
    console.log('  RPC DOES NOT EXIST');
  } else {
    defs.forEach(d => {
      console.log(`  Args: ${d.args}`);
      console.log(`  Returns: ${d.ret}`);
      console.log(`  Security Definer: ${d.secdef}`);
      console.log(`  ACL: ${d.acl || '(default)'}`);
    });
  }
});