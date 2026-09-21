import fs from 'fs';
import path from 'path';

const vpsTablesRaw = JSON.parse(fs.readFileSync('.agents/teamwork_preview_explorer_db_1/vps_tables.json', 'utf8'));
const vpsFuncsRaw = JSON.parse(fs.readFileSync('.agents/teamwork_preview_explorer_db_1/vps_functions.json', 'utf8'));
const vpsRlsRaw = JSON.parse(fs.readFileSync('.agents/teamwork_preview_explorer_db_1/vps_rls.json', 'utf8'));
const vpsTableStatusRaw = JSON.parse(fs.readFileSync('.agents/teamwork_preview_explorer_db_1/vps_table_status.json', 'utf8'));
const frontendCatalog = JSON.parse(fs.readFileSync('.agents/teamwork_preview_explorer_db_1/frontend_catalog.json', 'utf8'));

// Structure VPS tables
const dbTables = new Map(); // tableName -> Map(colName -> colObj)
for (const col of vpsTablesRaw) {
  if (!dbTables.has(col.table_name)) {
    dbTables.set(col.table_name, new Map());
  }
  dbTables.get(col.table_name).set(col.column_name, col);
}

// Structure VPS functions
const dbFuncs = new Map(); // funcName -> Array of overloads
for (const func of vpsFuncsRaw) {
  if (!dbFuncs.has(func.name)) {
    dbFuncs.set(func.name, []);
  }
  dbFuncs.get(func.name).push(func);
}

// Structure VPS RLS
const dbRls = new Map(); // tableName -> Array of policies
for (const pol of (vpsRlsRaw || [])) {
  if (!dbRls.has(pol.tablename)) {
    dbRls.set(pol.tablename, []);
  }
  dbRls.get(pol.tablename).push(pol);
}

// Structure Table Status
const dbTableStatus = new Map();
for (const ts of (vpsTableStatusRaw || [])) {
  dbTableStatus.set(ts.table_name, ts);
}

console.log('=== VPS DB STATS ===');
console.log('Total Tables in Public:', dbTables.size);
console.log('Total Functions in Public:', dbFuncs.size);
console.log('Total RLS Policies:', (vpsRlsRaw || []).length);

// 1. Cross-reference Tables
const missingTables = [];
const existingTables = [];

for (const tableName of Object.keys(frontendCatalog.tablesReferenced)) {
  if (!dbTables.has(tableName)) {
    missingTables.push({
      table: tableName,
      referencedIn: frontendCatalog.tablesReferenced[tableName].files
    });
  } else {
    existingTables.push(tableName);
  }
}

// 2. Cross-reference Columns for all tables
const columnIssues = [];
for (const [tableName, info] of Object.entries(frontendCatalog.tablesReferenced)) {
  if (!dbTables.has(tableName)) continue;
  const tableCols = dbTables.get(tableName);

  // Check selects
  for (const selStr of info.selects) {
    // Parse select string (e.g. "id, name, status, user:users(email)")
    // Note: joined relations like `user:users(...)` or `*, clientes(*)` need handling
    const rawTokens = selStr.split(',').map(s => s.trim());
    for (let token of rawTokens) {
      token = token.replace(/\s+/g, ' ');
      // Ignore wildcards, aggregations, functions (count(*), etc.), aliases, foreign joins
      if (token === '*' || token.includes('(') || token.includes(':') || token.includes('.')) {
        continue;
      }
      const colName = token.trim();
      if (colName && !tableCols.has(colName)) {
        columnIssues.push({
          table: tableName,
          column: colName,
          selectClause: selStr,
          files: info.files
        });
      }
    }
  }
}

// 3. Cross-reference Supabase RPCs
const missingSupabaseRpcs = [];
const existingSupabaseRpcs = [];
const supabaseRpcPermissionIssues = [];

for (const [rpcName, files] of Object.entries(frontendCatalog.supabaseRpcs)) {
  if (!dbFuncs.has(rpcName)) {
    missingSupabaseRpcs.push({ rpc: rpcName, files });
  } else {
    const overloads = dbFuncs.get(rpcName);
    existingSupabaseRpcs.push({ rpc: rpcName, overloads });
    // Check permissions
    for (const ov of overloads) {
      const grants = ov.grants || [];
      const hasAnon = grants.some(g => g.startsWith('anon:EXECUTE'));
      const hasAuth = grants.some(g => g.startsWith('authenticated:EXECUTE'));
      const hasService = grants.some(g => g.startsWith('service_role:EXECUTE'));
      if (!hasAnon && !hasAuth && !hasService) {
        supabaseRpcPermissionIssues.push({
          rpc: rpcName,
          args: ov.arguments,
          grants,
          files
        });
      }
    }
  }
}

// 4. Cross-reference Admin RPCs (callAdminRpc)
const missingAdminRpcs = [];
const existingAdminRpcs = [];
const adminRpcPermissionIssues = [];

for (const [rpcName, files] of Object.entries(frontendCatalog.adminRpcs)) {
  if (!dbFuncs.has(rpcName)) {
    missingAdminRpcs.push({ rpc: rpcName, files });
  } else {
    const overloads = dbFuncs.get(rpcName);
    existingAdminRpcs.push({ rpc: rpcName, overloads });
    for (const ov of overloads) {
      const grants = ov.grants || [];
      const hasAuth = grants.some(g => g.startsWith('authenticated:EXECUTE'));
      const hasAnon = grants.some(g => g.startsWith('anon:EXECUTE'));
      const hasService = grants.some(g => g.startsWith('service_role:EXECUTE'));
      if (!hasAuth && !hasAnon && !hasService) {
        adminRpcPermissionIssues.push({
          rpc: rpcName,
          args: ov.arguments,
          grants,
          files
        });
      }
    }
  }
}

// Specific check: Partner redemption system
const partnerTable = dbTables.get('parceiros');
const partnerResgatesTable = dbTables.get('parceiros_resgates');

const partnerAudit = {
  parceiros_exists: !!partnerTable,
  parceiros_cols: partnerTable ? Array.from(partnerTable.keys()) : [],
  resgates_exists: !!partnerResgatesTable,
  resgates_cols: partnerResgatesTable ? Array.from(partnerResgatesTable.keys()) : [],
  redemption_rpcs: {
    gsa_public_resgatar_beneficio_parceiro: dbFuncs.get('gsa_public_resgatar_beneficio_parceiro'),
    gsa_admin_save_partner: dbFuncs.get('gsa_admin_save_partner'),
    gsa_admin_partners_snapshot: dbFuncs.get('gsa_admin_partners_snapshot'),
    gsa_admin_list_partner_redemptions: dbFuncs.get('gsa_admin_list_partner_redemptions'),
    gsa_admin_complete_partner_redemption: dbFuncs.get('gsa_admin_complete_partner_redemption')
  }
};

const finalResult = {
  stats: {
    dbTablesCount: dbTables.size,
    dbFuncsCount: dbFuncs.size,
    frontendTablesCount: Object.keys(frontendCatalog.tablesReferenced).length,
    frontendSupabaseRpcsCount: Object.keys(frontendCatalog.supabaseRpcs).length,
    frontendAdminRpcsCount: Object.keys(frontendCatalog.adminRpcs).length
  },
  missingTables,
  columnIssues,
  missingSupabaseRpcs,
  supabaseRpcPermissionIssues,
  missingAdminRpcs,
  adminRpcPermissionIssues,
  partnerAudit
};

fs.writeFileSync(
  '.agents/teamwork_preview_explorer_db_1/audit_summary.json',
  JSON.stringify(finalResult, null, 2),
  'utf8'
);

console.log('=== AUDIT RESULTS ===');
console.log('Missing Tables:', missingTables.length);
if (missingTables.length > 0) console.log(JSON.stringify(missingTables, null, 2));

console.log('Column Issues:', columnIssues.length);
if (columnIssues.length > 0) console.log(JSON.stringify(columnIssues, null, 2));

console.log('Missing Supabase RPCs:', missingSupabaseRpcs.length);
if (missingSupabaseRpcs.length > 0) console.log(JSON.stringify(missingSupabaseRpcs, null, 2));

console.log('Supabase RPC Permission Issues:', supabaseRpcPermissionIssues.length);

console.log('Missing Admin RPCs:', missingAdminRpcs.length);
if (missingAdminRpcs.length > 0) console.log(JSON.stringify(missingAdminRpcs, null, 2));

console.log('Admin RPC Permission Issues:', adminRpcPermissionIssues.length);
