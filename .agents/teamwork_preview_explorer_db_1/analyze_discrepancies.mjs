import fs from 'fs';
import path from 'path';

const disc = JSON.parse(fs.readFileSync('.agents/teamwork_preview_explorer_db_1/audit_discrepancies.json', 'utf-8'));

console.log('=== DETAILED DISCREPANCY ANALYSIS ===');
console.log(`Total Column Discrepancy Entries: ${disc.columnDiscrepancies.length}`);

for (const item of disc.columnDiscrepancies) {
  console.log(`\n-----------------------------------------`);
  console.log(`Column / Field: ${item.col}`);
  console.log(`Files referenced:`, item.files);
}
