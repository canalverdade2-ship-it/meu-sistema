import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'supabase', 'migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql') && !f.endsWith('.b64')).sort();

// Function name -> { name, args, isDefiner, searchPath, grants: Set, revokes: Set, body, file, line }
const functions = new Map();

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');

  // Function definitions
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

    const upTo = content.substring(0, fnMatch.index);
    const lineNum = upTo.split('\n').length;

    const existing = functions.get(fnName) || { grants: new Set(), revokes: new Set() };
    functions.set(fnName, {
      name: fnName,
      args,
      isDefiner,
      searchPath,
      grants: existing.grants,
      revokes: existing.revokes,
      body,
      file,
      line: lineNum
    });
  }

  // Revokes
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

  // Grants
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

  // Also check dynamic revokes in 20260830235500_system_end_to_end_security_remediation.sql
  if (file.includes('20260830235500_system_end_to_end_security_remediation.sql')) {
    const revokedFns = [
      'get_auth_users_details','get_database_details','get_system_metrics',
      'get_storage_details','get_admin_system_status','get_admin_counts',
      'get_admin_pendency_counts','verify_admin_access','execute_sql',
      'delete_client_cascade','cliente_operational_write'
    ];
    for (const fn of revokedFns) {
      const existing = functions.get(fn);
      if (existing) {
        existing.revokes.add('public');
        existing.revokes.add('anon');
        existing.revokes.add('authenticated');
        existing.grants.delete('public');
        existing.grants.delete('anon');
        existing.grants.delete('authenticated');
      }
    }
  }
}

const anonExposed = [];

for (const [fnName, fnData] of functions.entries()) {
  const isAnon = fnData.grants.has('anon') || fnData.grants.has('public');
  if (isAnon) {
    const hasMutations = /UPDATE\s+|INSERT\s+INTO|DELETE\s+FROM/i.test(fnData.body);
    const hasAuthCheck = /auth\.uid\(\)|gsa_jwt_actor_type\(\)|gsa_admin_session_actor|gsa_client_session_actor/i.test(fnData.body);
    anonExposed.push({
      name: fnName,
      isDefiner: fnData.isDefiner,
      searchPath: fnData.searchPath,
      hasMutations,
      hasAuthCheck,
      file: fnData.file,
      line: fnData.line
    });
  }
}

console.log(`Total functions callable by anon/public: ${anonExposed.length}`);
console.log('\n--- FUNCTIONS CALLABLE BY ANON WITH DATABASE MUTATIONS ---');
const mutatingAnon = anonExposed.filter(f => f.hasMutations);
console.log(`Count: ${mutatingAnon.length}`);
mutatingAnon.forEach(f => {
  console.log(`- ${f.name} [SECURITY DEFINER: ${f.isDefiner}]`);
  console.log(`  Auth checks: ${f.hasAuthCheck ? 'YES' : 'NONE ❌'}`);
  console.log(`  Source: ${f.file}:${f.line}\n`);
});
