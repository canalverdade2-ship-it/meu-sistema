const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'ast_audit_result.json'), 'utf8'));

console.log('Total index as key:', data.indexAsKey.length);

const grouped = {};
data.indexAsKey.forEach(item => {
  if (!grouped[item.file]) grouped[item.file] = [];
  grouped[item.file].push(item);
});

console.log('Files with index as key:', Object.keys(grouped).length);
for (const [file, items] of Object.entries(grouped)) {
  console.log(`\n${file} (${items.length}):`);
  items.slice(0, 5).forEach(i => console.log(`  Line ${i.line}: <${i.element} key={${i.keyExpr}}>`));
  if (items.length > 5) console.log(`  ... and ${items.length - 5} more`);
}
