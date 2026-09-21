const fs = require('fs');
const path = require('path');

const summary = JSON.parse(fs.readFileSync(path.join(__dirname, 'db_analysis_summary.json'), 'utf8'));

console.log('Analyzing RLS policies and security boundaries...');

const roleBreakdown = {
  anon: 0,
  authenticated: 0,
  service_role: 0,
  public: 0,
  other: 0
};

const cmdBreakdown = {
  ALL: 0,
  SELECT: 0,
  INSERT: 0,
  UPDATE: 0,
  DELETE: 0
};

const tablePolicyMap = new Map();

for (const p of summary.tables.flatMap(t => t.policies || [])) {
  const r = (p.roles || '').toLowerCase();
  if (r.includes('anon')) roleBreakdown.anon++;
  if (r.includes('authenticated')) roleBreakdown.authenticated++;
  if (r.includes('service_role')) roleBreakdown.service_role++;
  if (r.includes('public')) roleBreakdown.public++;

  const c = p.command || 'ALL';
  cmdBreakdown[c] = (cmdBreakdown[c] || 0) + 1;

  if (!tablePolicyMap.has(p.table)) tablePolicyMap.set(p.table, []);
  tablePolicyMap.get(p.table).push(p);
}

console.log('Role counts:', roleBreakdown);
console.log('Command counts:', cmdBreakdown);
console.log(`Tables with explicit policies: ${tablePolicyMap.size}`);

// Write detailed RLS report JSON
fs.writeFileSync(path.join(__dirname, 'rls_policy_analysis.json'), JSON.stringify({
  totalPolicies: summary.policyCount,
  roleBreakdown,
  cmdBreakdown,
  tablePolicyMap: Object.fromEntries(tablePolicyMap.entries())
}, null, 2), 'utf8');

console.log('Saved rls_policy_analysis.json');
