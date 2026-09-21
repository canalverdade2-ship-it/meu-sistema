import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationsDir = path.join(root, "supabase", "migrations");

const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith(".sql") && !f.endsWith(".b64"))
  .sort();

console.log(`Analyzing ${migrationFiles.length} migration files...`);

const tables = new Map(); // name -> { createdIn, rlsEnabled, rlsFile, rlsForced, policies: Map<name, policyObj>, directGrants: Map<role, Set> }
const functions = new Map(); // signature/name -> { name, args, isDefiner, searchPath, authChecks: [], grants: Set, revokes: Set, file, body, line }
const triggers = new Map(); // triggerName@tableName -> { name, table, timing, events, func, file, line }

function getTable(name) {
  const norm = name.toLowerCase().replace(/^public\./, "").replace(/^["']|["']$/g, "");
  if (!tables.has(norm)) {
    tables.set(norm, {
      name: norm,
      createdIn: null,
      rlsEnabled: false,
      rlsFile: null,
      rlsForced: false,
      policies: new Map(),
      directGrants: new Map()
    });
  }
  return tables.get(norm);
}

for (const file of migrationFiles) {
  const filePath = path.join(migrationsDir, file);
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  // 1. CREATE TABLE
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_"\.]+)/gi;
  let ctMatch;
  while ((ctMatch = createTableRegex.exec(content)) !== null) {
    const rawName = ctMatch[1];
    if (rawName.includes("(") || rawName.includes(";")) continue;
    const t = getTable(rawName);
    if (!t.createdIn) t.createdIn = file;
  }

  // 2. ALTER TABLE ... ENABLE ROW LEVEL SECURITY
  const rlsRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-zA-Z0-9_"\.]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
  let rlsMatch;
  while ((rlsMatch = rlsRegex.exec(content)) !== null) {
    const rawName = rlsMatch[1];
    const t = getTable(rawName);
    t.rlsEnabled = true;
    t.rlsFile = file;
  }

  // 2b. FORCE ROW LEVEL SECURITY
  const forceRlsRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-zA-Z0-9_"\.]+)\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/gi;
  let forceMatch;
  while ((forceMatch = forceRlsRegex.exec(content)) !== null) {
    const rawName = forceMatch[1];
    const t = getTable(rawName);
    t.rlsForced = true;
  }

  // 2c. DISABLE ROW LEVEL SECURITY
  const disableRlsRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-zA-Z0-9_"\.]+)\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
  let disableMatch;
  while ((disableMatch = disableRlsRegex.exec(content)) !== null) {
    const rawName = disableMatch[1];
    const t = getTable(rawName);
    t.rlsEnabled = false;
    t.rlsFile = `DISABLED in ${file}`;
  }

  // 2d. Dynamic RLS loops in plpgsql migrations
  if (content.includes("ENABLE ROW LEVEL SECURITY")) {
    const unnestMatches = content.matchAll(/unnest\s*\(\s*ARRAY\s*\[([\s\S]*?)\]\s*\)/gi);
    for (const um of unnestMatches) {
      const tblList = um[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '').toLowerCase()).filter(Boolean);
      for (const rawName of tblList) {
        const t = getTable(rawName);
        t.rlsEnabled = true;
        t.rlsFile = file;
      }
    }
    const arrayMatch = content.match(/v_tables\s+(?:constant\s+text\[\]\s*:=|:=)\s*ARRAY\[([\s\S]*?)\];/i);
    if (arrayMatch) {
      const tblList = arrayMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '').toLowerCase()).filter(Boolean);
      for (const rawName of tblList) {
        const t = getTable(rawName);
        t.rlsEnabled = true;
        t.rlsFile = file;
        if (content.includes("DROP POLICY IF EXISTS %I ON public.%I")) {
          t.policies.clear();
        }
      }
    }
  }

  // 3. DROP POLICY
  const dropPolRegex = /DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_"\.]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_"\.]+)/gi;
  let dpMatch;
  while ((dpMatch = dropPolRegex.exec(content)) !== null) {
    const polName = dpMatch[1].toLowerCase().replace(/^["']|["']$/g, "");
    const rawTbl = dpMatch[2];
    const t = getTable(rawTbl);
    t.policies.delete(polName);
  }

  // 4. CREATE POLICY
  const createPolRegex = /CREATE\s+POLICY\s+([a-zA-Z0-9_"\.]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_"\.]+)([\s\S]*?);/gi;
  let cpMatch;
  while ((cpMatch = createPolRegex.exec(content)) !== null) {
    const polName = cpMatch[1].toLowerCase().replace(/^["']|["']$/g, "");
    const rawTbl = cpMatch[2];
    const rest = cpMatch[3];
    const t = getTable(rawTbl);

    let cmd = 'ALL';
    const cmdM = rest.match(/FOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)/i);
    if (cmdM) cmd = cmdM[1].toUpperCase();

    let roles = ['public'];
    const rolesM = rest.match(/TO\s+([a-zA-Z0-9_,\s]+?)(?:USING|WITH\s+CHECK|$)/i);
    if (rolesM) roles = rolesM[1].split(',').map(r => r.trim().toLowerCase()).filter(Boolean);

    let qual = '';
    const qualM = rest.match(/USING\s*\(([\s\S]*?)\)(?:\s+WITH\s+CHECK|$)/i);
    if (qualM) qual = qualM[1].trim();

    let withCheck = '';
    const withCheckM = rest.match(/WITH\s+CHECK\s*\(([\s\S]*?)\)$/i);
    if (withCheckM) withCheck = withCheckM[1].trim();

    const upTo = content.substring(0, cpMatch.index);
    const lineNum = upTo.split("\n").length;

    t.policies.set(polName, {
      name: polName,
      table: t.name,
      cmd,
      roles,
      qual,
      withCheck,
      file,
      line: lineNum
    });
  }

  // 5. FUNCTION DEFINITIONS
  const funcRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)([\s\S]*?)(?:RETURNS|LANGUAGE)([\s\S]*?)(AS\s*\$\$|AS\s*\$[a-zA-Z0-9_]*\$)([\s\S]*?)(\$\$|\$[a-zA-Z0-9_]*\$)\s*;/gi;
  let fnMatch;
  while ((fnMatch = funcRegex.exec(content)) !== null) {
    const fnName = fnMatch[1].toLowerCase();
    const args = fnMatch[2].trim();
    const preHeader = fnMatch[3] + fnMatch[4];
    const body = fnMatch[6];

    const isDefiner = /SECURITY\s+DEFINER/i.test(preHeader);
    const spMatch = preHeader.match(/SET\s+search_path\s*(?:=|TO)\s*([a-zA-Z0-9_,\s"']+)/i);
    const searchPath = spMatch ? spMatch[1].trim() : null;

    const authChecks = [];
    if (/auth\.uid\(\)/i.test(body)) authChecks.push('auth.uid()');
    if (/auth\.role\(\)/i.test(body)) authChecks.push('auth.role()');
    if (/gsa_jwt_actor_type\(\)/i.test(body)) authChecks.push('gsa_jwt_actor_type()');
    if (/gsa_jwt_actor_id\(\)/i.test(body)) authChecks.push('gsa_jwt_actor_id()');
    if (/gsa_jwt_is_admin\(\)/i.test(body)) authChecks.push('gsa_jwt_is_admin()');
    if (/gsa_admin_session_actor/i.test(body)) authChecks.push('gsa_admin_session_actor()');
    if (/gsa_client_session_actor/i.test(body)) authChecks.push('gsa_client_session_actor()');
    if (/gsa_admin_validate_context/i.test(body)) authChecks.push('gsa_admin_validate_context()');
    if (/set_config\s*\(\s*['"]my\.app\.bypass_saldo_check/i.test(body)) authChecks.push('bypass_saldo_check');
    if (/FOR\s+UPDATE/i.test(body)) authChecks.push('FOR UPDATE');

    const upTo = content.substring(0, fnMatch.index);
    const lineNum = upTo.split("\n").length;

    const existing = functions.get(fnName) || { grants: new Set(), revokes: new Set() };
    functions.set(fnName, {
      name: fnName,
      args,
      isDefiner,
      searchPath,
      authChecks,
      grants: existing.grants,
      revokes: existing.revokes,
      file,
      line: lineNum,
      bodyLength: body.length
    });
  }

  // 5b. FUNCTION GRANTS & REVOKES
  const revFuncRegex = /REVOKE\s+ALL\s+ON\s+FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\([\s\S]*?\)\s+FROM\s+([a-zA-Z0-9_,\s]+);/gi;
  let rfnMatch;
  while ((rfnMatch = revFuncRegex.exec(content)) !== null) {
    const fnName = rfnMatch[1].toLowerCase();
    const roles = rfnMatch[2].split(',').map(r => r.trim().toLowerCase());
    const existing = functions.get(fnName) || { grants: new Set(), revokes: new Set() };
    functions.set(fnName, existing);
    for (const r of roles) {
      existing.revokes.add(r);
      existing.grants.delete(r);
    }
  }

  const grFuncRegex = /GRANT\s+(?:EXECUTE|ALL)\s+ON\s+FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\([\s\S]*?\)\s+TO\s+([a-zA-Z0-9_,\s]+);/gi;
  let gfnMatch;
  while ((gfnMatch = grFuncRegex.exec(content)) !== null) {
    const fnName = gfnMatch[1].toLowerCase();
    const roles = gfnMatch[2].split(',').map(r => r.trim().toLowerCase());
    const existing = functions.get(fnName) || { grants: new Set(), revokes: new Set() };
    functions.set(fnName, existing);
    for (const r of roles) {
      existing.grants.add(r);
      existing.revokes.delete(r);
    }
  }

  // 6. CREATE TRIGGER
  const trgRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([a-zA-Z0-9_]+)\s+(BEFORE|AFTER|INSTEAD\s+OF)\s+([a-zA-Z0-9_\s\(\),]+?)\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)[\s\S]*?EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;
  let trgMatch;
  while ((trgMatch = trgRegex.exec(content)) !== null) {
    const trgName = trgMatch[1].toLowerCase();
    const timing = trgMatch[2].toUpperCase();
    const events = trgMatch[3].trim().toUpperCase();
    const rawTbl = trgMatch[4].toLowerCase();
    const funcName = trgMatch[5].toLowerCase();

    const upTo = content.substring(0, trgMatch.index);
    const lineNum = upTo.split("\n").length;

    const key = `${trgName}@${rawTbl}`;
    triggers.set(key, {
      name: trgName,
      table: rawTbl,
      timing,
      events,
      func: funcName,
      file,
      line: lineNum
    });
  }
}

console.log(`Total Tables parsed: ${tables.size}`);
console.log(`Total Functions parsed: ${functions.size}`);
console.log(`Total Triggers parsed: ${triggers.size}`);

const report = {
  summary: {
    totalMigrations: migrationFiles.length,
    totalTables: tables.size,
    totalFunctions: functions.size,
    totalTriggers: triggers.size
  },
  tablesWithoutRLS: [],
  tablesWithRLSNoPolicies: [],
  wildcardPolicies: [],
  secDefinerWithoutSearchPath: [],
  secDefinerWithoutAuth: [],
  anonCallableSecDefiner: [],
  financialDirectWritePolicies: [],
  allTables: []
};

for (const [tName, tData] of tables.entries()) {
  const polList = Array.from(tData.policies.values());
  report.allTables.push({
    name: tName,
    createdIn: tData.createdIn,
    rls: tData.rlsEnabled,
    policiesCount: polList.length
  });

  if (!tData.rlsEnabled) {
    report.tablesWithoutRLS.push({
      table: tName,
      createdIn: tData.createdIn,
      rlsStatus: tData.rlsFile || 'NEVER ENABLED'
    });
  } else {
    if (tData.policies.size === 0) {
      report.tablesWithRLSNoPolicies.push({
        table: tName,
        rlsFile: tData.rlsFile
      });
    }
  }

  for (const [pName, pData] of tData.policies.entries()) {
    const qualNorm = pData.qual.replace(/\s+/g, ' ').toLowerCase();
    const checkNorm = pData.withCheck.replace(/\s+/g, ' ').toLowerCase();
    const isPublicOrAnon = pData.roles.includes('public') || pData.roles.includes('anon');
    const isAuthenticated = pData.roles.includes('authenticated');

    if (qualNorm === 'true' || qualNorm === '(true)' || checkNorm === 'true' || checkNorm === '(true)') {
      const isPrivileged = pName.includes('service_role') || pName.includes('admin') || pName.includes('management');
      if (!isPrivileged && (isPublicOrAnon || isAuthenticated)) {
        report.wildcardPolicies.push({
          table: tName,
          policy: pName,
          cmd: pData.cmd,
          roles: pData.roles,
          qual: pData.qual,
          withCheck: pData.withCheck,
          file: pData.file,
          line: pData.line,
          isPublicOrAnon
        });
      }
    }

    const financialTables = [
      'saques', 'carteira_lancamentos', 'extrato_financeiro', 'pontos_movimentacoes',
      'points_transactions', 'faturas', 'pagamentos', 'transferencias', 'emprestimos',
      'gsa_afiliado_saques', 'gsa_afiliado_comissoes', 'prestador_saques', 'prestador_transacoes'
    ];
    if (financialTables.includes(tName)) {
      const isWrite = pData.cmd === 'INSERT' || pData.cmd === 'UPDATE' || pData.cmd === 'DELETE' || pData.cmd === 'ALL';
      if (isWrite && (isAuthenticated || isPublicOrAnon)) {
        const isStrictAdmin = pName.includes('admin') || pData.qual.includes('admin') || pData.withCheck.includes('admin');
        if (!isStrictAdmin) {
          report.financialDirectWritePolicies.push({
            table: tName,
            policy: pName,
            cmd: pData.cmd,
            roles: pData.roles,
            qual: pData.qual,
            withCheck: pData.withCheck,
            file: pData.file,
            line: pData.line
          });
        }
      }
    }
  }
}

for (const [fnName, fnData] of functions.entries()) {
  if (fnData.isDefiner) {
    if (!fnData.searchPath) {
      report.secDefinerWithoutSearchPath.push({
        function: fnName,
        file: fnData.file,
        line: fnData.line
      });
    }

    if (fnData.authChecks.length === 0) {
      report.secDefinerWithoutAuth.push({
        function: fnName,
        file: fnData.file,
        line: fnData.line,
        grants: Array.from(fnData.grants)
      });
    }

    const hasAnonGrant = fnData.grants.has('anon') || fnData.grants.has('public');
    const hasAnonRevoke = fnData.revokes.has('anon') || fnData.revokes.has('public');
    if (hasAnonGrant && !hasAnonRevoke) {
      report.anonCallableSecDefiner.push({
        function: fnName,
        file: fnData.file,
        line: fnData.line,
        authChecks: fnData.authChecks
      });
    }
  }
}

fs.writeFileSync(path.join(root, 'scratch', 'audit_full_database_report.json'), JSON.stringify(report, null, 2));

console.log(`--- RESULTS SUMMARY ---`);
console.log(`Tables without RLS: ${report.tablesWithoutRLS.length}`);
console.log(`Tables with RLS but 0 policies: ${report.tablesWithRLSNoPolicies.length}`);
console.log(`Wildcard USING (true) policies (public/anon/authenticated): ${report.wildcardPolicies.length}`);
console.log(`SECURITY DEFINER functions without search_path: ${report.secDefinerWithoutSearchPath.length}`);
console.log(`SECURITY DEFINER functions without auth checks: ${report.secDefinerWithoutAuth.length}`);
console.log(`SECURITY DEFINER functions callable by anon: ${report.anonCallableSecDefiner.length}`);
console.log(`Direct write policies on financial tables: ${report.financialDirectWritePolicies.length}`);
