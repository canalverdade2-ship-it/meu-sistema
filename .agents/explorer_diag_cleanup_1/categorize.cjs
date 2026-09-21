const fs = require('fs');
const path = require('path');

const root = process.cwd();
const detailed = JSON.parse(fs.readFileSync(path.join(root, '.agents', 'explorer_diag_cleanup_1', 'detailed_unreachable_admin.json'), 'utf8'));

// Categorize into:
// Category 1: Pure Dead UI / Orphan Files (0 imports from active, 0 imports from anywhere active, 0 scripts assertions, 0 tests)
// Category 2: Dead Subtree Files (Only imported by Category 1 or Category 2, 0 scripts assertions, 0 tests)
// Category 3: Dead UI Modules with Direct Assertions in scripts/ (e.g. check-admin-panel-contracts.ts, check-advertising-completion.ts, etc.)
// Category 4: Legacy files with references in unit tests (e.g. Dashboard.tsx)

const cat1_orphan = [];
const cat2_subtree = [];
const cat3_contract_locked = [];
const cat4_test_referenced = [];

for (const item of detailed) {
  if (item.testMatches.length > 0) {
    cat4_test_referenced.push(item);
  } else if (item.scriptMatches.length > 0) {
    cat3_contract_locked.push(item);
  } else if (item.importedBy.length === 0) {
    cat1_orphan.push(item);
  } else {
    cat2_subtree.push(item);
  }
}

console.log(`Summary:`);
console.log(`Category 1 (Pure Orphan, 0 refs anywhere): ${cat1_orphan.length} files (${cat1_orphan.reduce((s, i) => s + i.lines, 0)} lines)`);
console.log(`Category 2 (Dead Subtree, 0 external refs): ${cat2_subtree.length} files (${cat2_subtree.reduce((s, i) => s + i.lines, 0)} lines)`);
console.log(`Category 3 (Locked by Contract Scripts): ${cat3_contract_locked.length} files (${cat3_contract_locked.reduce((s, i) => s + i.lines, 0)} lines)`);
console.log(`Category 4 (Referenced in Tests): ${cat4_test_referenced.length} files (${cat4_test_referenced.reduce((s, i) => s + i.lines, 0)} lines)`);

console.log('\n--- CATEGORY 1: Pure Orphans (0 refs anywhere) ---');
for (const it of cat1_orphan) {
  console.log(`- ${it.file} (${it.lines} lines) -> Superseded by ${it.superDomain}`);
}

console.log('\n--- CATEGORY 2: Dead Subtree (Only imported by dead files) ---');
for (const it of cat2_subtree) {
  console.log(`- ${it.file} (${it.lines} lines) -> Imported by: ${it.importedBy.join(', ')} -> Superseded by ${it.superDomain}`);
}

console.log('\n--- CATEGORY 3: Locked by scripts/ checks ---');
for (const it of cat3_contract_locked) {
  console.log(`- ${it.file} (${it.lines} lines) -> Scripts: ${it.scriptMatches.join(', ')} -> Superseded by ${it.superDomain}`);
}

console.log('\n--- CATEGORY 4: Referenced in Tests ---');
for (const it of cat4_test_referenced) {
  console.log(`- ${it.file} (${it.lines} lines) -> Tests: ${it.testMatches.join(', ')}`);
}
