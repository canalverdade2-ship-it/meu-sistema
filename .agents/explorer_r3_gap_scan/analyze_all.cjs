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

const realtimeKeywords = [
  'useRealtime',
  'useRealtimeSubscription',
  'useRealtimeTable',
  'subscribeToTable',
  'supabase.channel',
  '.channel('
];

const fileDetails = [];

for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(path.resolve(__dirname, '../..'), filePath).replace(/\\/g, '/');

  const hasRealtime = realtimeKeywords.some(kw => content.includes(kw));
  
  // Find all supabase queries
  const selectMatches = [...content.matchAll(/supabase\s*(?:\.\s*schema\([^)]+\))?\s*\.\s*from\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.\s*select\(([^)]*)\)/g)];
  const allFromMatches = [...content.matchAll(/supabase\s*(?:\.\s*schema\([^)]+\))?\s*\.\s*from\(\s*['"`]([^'"`]+)['"`]\s*\)/g)];
  
  const tables = [...new Set(allFromMatches.map(m => m[1]))];
  const selectTables = [...new Set(selectMatches.map(m => m[1]))];

  const hasUseEffect = content.includes('useEffect');
  const hasUseState = content.includes('useState');
  
  fileDetails.push({
    relPath,
    hasRealtime,
    tables,
    selectTables,
    hasUseEffect,
    hasUseState,
    lines: content.split('\n').length
  });
}

const nonRealtimeComponents = fileDetails.filter(f => !f.hasRealtime && (f.tables.length > 0 || f.selectTables.length > 0));

console.log(`TOTAL NON-REALTIME FILES QUERYING SUPABASE: ${nonRealtimeComponents.length}`);
nonRealtimeComponents.forEach(f => {
  console.log(`FILE: ${f.relPath} | TABLES: ${f.tables.join(', ')} | SELECT_TABLES: ${f.selectTables.join(', ')} | USE_EFFECT: ${f.hasUseEffect}`);
});
