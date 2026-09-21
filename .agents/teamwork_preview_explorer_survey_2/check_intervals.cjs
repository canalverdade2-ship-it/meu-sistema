const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'ast_audit_result.json'), 'utf8'));

console.log('Suspicious intervals:', data.suspiciousIntervals.length);
data.suspiciousIntervals.forEach(item => {
  console.log(`\n${item.file}:${item.line}`);
  console.log(`  ${item.text}`);
});
