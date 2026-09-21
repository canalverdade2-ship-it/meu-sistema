const fs = require('fs');

const audit = JSON.parse(fs.readFileSync('.agents/explorer_r5_antipatterns/full_98_audit.json', 'utf8'));

console.log('=== DETAILED LIST OF DETECTED ANTI-PATTERNS IN 98 TARGET FILES ===');

audit.filter(a => a.severity !== '🟢 OK').forEach((item, idx) => {
  console.log(`\n[${idx + 1}] ${item.severity} - ${item.name} (${item.path})`);
  console.log(`Hook used: ${item.hookType}`);
  console.log(`Tables: ${item.tables.join(', ')}`);
  item.antiPatterns.forEach(ap => {
    console.log(`  - [${ap.severity}] ${ap.category}: ${ap.detail}`);
  });
});
