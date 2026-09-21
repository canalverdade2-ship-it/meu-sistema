const fs = require('fs');
const path = require('path');

const root = process.cwd();
const audit = JSON.parse(fs.readFileSync(path.join(root, '.agents', 'explorer_diag_cleanup_1', 'all_unreachable.json'), 'utf8'));

const nonAdminUnreachable = [];
for (const [dir, files] of Object.entries(audit)) {
  if (!dir.startsWith('src/components/admin') && !dir.startsWith('src/tests') && !dir.startsWith('src/types') && dir !== 'src') {
    nonAdminUnreachable.push(...files);
  }
}

const detailed = nonAdminUnreachable.map(item => {
  const fullPath = path.join(root, item.file);
  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n').length;
  return {
    file: item.file,
    lines,
    importedBy: item.importedBy,
    scriptMatches: item.scriptMatches,
    testMatches: item.testMatches,
  };
});

fs.writeFileSync(
  path.join(root, '.agents', 'explorer_diag_cleanup_1', 'detailed_non_admin_unreachable.json'),
  JSON.stringify(detailed, null, 2),
  'utf8'
);

console.log(`Non-admin unreachable files (${detailed.length}):`);
for (const it of detailed) {
  console.log(`${it.file} (${it.lines} lines) | ImportedBy: ${it.importedBy.length} | Scripts: ${it.scriptMatches.length} | Tests: ${it.testMatches.length}`);
}
