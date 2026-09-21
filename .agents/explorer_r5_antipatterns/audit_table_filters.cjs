const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.agents' && file !== 'dist') {
        results = results.concat(walk(filePath));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk('src');

const tableAudit = [];

files.forEach(f => {
  if (f.includes('realtime-hook.test.ts')) return;
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');

  // Let's find useRealtimeSubscription, useRealtime, useRealtimeTable, and .channel
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pattern 1: { table: 'xyz', ... }
    const matchTableObj = line.match(/table:\s*['"`]([a-zA-Z0-9_-]+)['"`]/);
    if (matchTableObj) {
      const table = matchTableObj[1];
      // look for filter in the enclosing object { ... }
      // find start of object {
      let objText = line;
      let start = i;
      while (start > 0 && !lines[start].includes('{') && i - start < 10) {
        start--;
      }
      let end = i;
      while (end < lines.length - 1 && !lines[end].includes('}') && end - i < 10) {
        end++;
      }
      objText = lines.slice(start, end + 1).join('\n');
      const hasFilter = objText.includes('filter:');
      const filterMatch = objText.match(/filter:\s*([^,\n}]+)/);
      const filterVal = filterMatch ? filterMatch[1].trim() : null;

      tableAudit.push({
        file: f,
        line: i + 1,
        table,
        hasFilter,
        filterVal,
        snippet: objText.trim()
      });
    }
  }
});

console.log(`Total table configs analyzed: ${tableAudit.length}`);

// Group by table
const byTable = {};
tableAudit.forEach(item => {
  if (!byTable[item.table]) byTable[item.table] = [];
  byTable[item.table].push(item);
});

console.log('\n--- TOP TABLES AUDITED ---');
Object.keys(byTable).sort((a,b) => byTable[b].length - byTable[a].length).forEach(t => {
  const items = byTable[t];
  const withFilter = items.filter(x => x.hasFilter).length;
  const withoutFilter = items.filter(x => !x.hasFilter).length;
  console.log(`Table: ${t.padEnd(30)} | Total: ${items.length.toString().padStart(2)} | With Filter: ${withFilter.toString().padStart(2)} | No Filter: ${withoutFilter.toString().padStart(2)}`);
});

fs.writeFileSync('.agents/explorer_r5_antipatterns/table_audit_summary.json', JSON.stringify(byTable, null, 2));
