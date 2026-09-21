const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'ast_audit_result.json'), 'utf8'));

const groups = {};
for (const item of data.realtimeChannelThrashing) {
  const file = item.file;
  if (!groups[file]) groups[file] = [];
  groups[file].push(item);
}

console.log(`Files with Realtime Channel Thrashing: ${Object.keys(groups).length}`);
for (const [file, items] of Object.entries(groups)) {
  console.log(`\n${file}:`);
  items.forEach(i => console.log(`  Line ${i.line}: ${i.deps}`));
}
