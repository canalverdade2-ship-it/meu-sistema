const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../../src');

function getAllFiles(dir, exts = ['.ts', '.tsx']) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, exts));
    } else {
      if (exts.some(ext => file.endsWith(ext))) {
        results.push(filePath);
      }
    }
  }
  return results;
}

const files = getAllFiles(srcDir);

const realtimeKeywords = ['useRealtime', 'useRealtimeSubscription', 'useRealtimeTable', 'subscribeToTable', 'supabase.channel', '.channel('];

const missingRealtimeCandidates = [];

for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(path.resolve(__dirname, '../..'), filePath).replace(/\\/g, '/');

  const hasRealtime = realtimeKeywords.some(kw => content.includes(kw));
  if (hasRealtime) continue;

  const isTsx = filePath.endsWith('.tsx');
  const isHook = relPath.includes('hook') || relPath.includes('use');
  const isContext = relPath.includes('context');

  // Supabase queries
  const selectMatches = [...content.matchAll(/supabase\s*(?:\.\s*schema\([^)]+\))?\s*\.\s*from\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.\s*select\(([^)]*)\)/g)];
  const fromMatches = [...content.matchAll(/supabase\s*(?:\.\s*schema\([^)]+\))?\s*\.\s*from\(\s*['"`]([^'"`]+)['"`]\s*\)/g)];
  
  const tables = [...new Set(fromMatches.map(m => m[1]))];
  const selectTables = [...new Set(selectMatches.map(m => m[1]))];

  if (tables.length > 0 && (isTsx || isHook || isContext)) {
    // Check if it's a test file or validation file
    if (relPath.includes('test') || relPath.includes('validation')) continue;

    missingRealtimeCandidates.push({
      path: relPath,
      tables,
      selectTables,
      hasUseEffect: content.includes('useEffect'),
      lines: content.split('\n').length
    });
  }
}

console.log(`Total Candidates Found: ${missingRealtimeCandidates.length}\n`);
missingRealtimeCandidates.forEach(c => {
  console.log(`- Path: ${c.path}`);
  console.log(`  Tables: ${c.tables.join(', ')}`);
  console.log(`  Select Tables: ${c.selectTables.join(', ')}`);
  console.log(`  Lines: ${c.lines}, useEffect: ${c.hasUseEffect}\n`);
});
