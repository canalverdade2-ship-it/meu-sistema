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

const auditResults = [];

for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(path.resolve(__dirname, '../..'), filePath).replace(/\\/g, '/');

  const hasRealtime = realtimeKeywords.some(kw => content.includes(kw));
  
  // Find all supabase queries
  const selectMatches = [...content.matchAll(/supabase\s*(?:\.\s*schema\([^)]+\))?\s*\.\s*from\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.\s*select\(([^)]*)\)/g)];
  const allFromMatches = [...content.matchAll(/supabase\s*(?:\.\s*schema\([^)]+\))?\s*\.\s*from\(\s*['"`]([^'"`]+)['"`]\s*\)/g)];
  
  const tables = [...new Set(allFromMatches.map(m => m[1]))];
  const selectTables = [...new Set(selectMatches.map(m => m[1]))];

  // Check if component
  const isTsx = filePath.endsWith('.tsx');
  const isHook = relPath.includes('use') || relPath.includes('hooks');
  const isLib = relPath.includes('lib/') || relPath.includes('utils/') || relPath.includes('services/') || relPath.includes('features/');
  const isValidation = relPath.includes('validation/');

  auditResults.push({
    path: relPath,
    isTsx,
    isHook,
    isLib,
    isValidation,
    hasRealtime,
    tables,
    selectTables,
    hasUseEffect: content.includes('useEffect'),
    lines: content.split('\n').length
  });
}

const nonRealtimeQueries = auditResults.filter(r => !r.hasRealtime && r.selectTables.length > 0 && !r.isValidation);

console.log(JSON.stringify(nonRealtimeQueries, null, 2));
