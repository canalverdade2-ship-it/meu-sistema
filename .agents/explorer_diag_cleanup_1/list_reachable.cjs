const fs = require('fs');
const path = require('path');

const root = process.cwd();
const audit = JSON.parse(fs.readFileSync(path.join(root, '.agents', 'explorer_diag_cleanup_1', 'dependency_audit.json'), 'utf8'));

console.log(`Reachable admin files (${audit.reachableAdmin.length}):`);
const bySubdir = {};
for (const f of audit.reachableAdmin) {
  const dir = path.dirname(f);
  if (!bySubdir[dir]) bySubdir[dir] = [];
  bySubdir[dir].push(f);
}

for (const [dir, list] of Object.entries(bySubdir)) {
  console.log(`\n--- ${dir} (${list.length} files) ---`);
  for (const f of list) {
    console.log(`  ${path.basename(f)}`);
  }
}
