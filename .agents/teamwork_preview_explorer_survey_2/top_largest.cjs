const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'ast_audit_result.json'), 'utf8'));

data.largeComponents.sort((a, b) => b.lines - a.lines);
console.log(`Top 25 largest components:`);
data.largeComponents.slice(0, 25).forEach((c, idx) => {
  console.log(`${idx + 1}. ${c.file}: ${c.lines} lines`);
});
