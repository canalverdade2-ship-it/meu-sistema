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

const realtimePatterns = [
  'useRealtime',
  'useRealtimeSubscription',
  'useRealtimeTable',
  'subscribeToTable',
  'supabase.channel',
  '.channel('
];

const results = [];

for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(srcDir, filePath).replace(/\\/g, '/');

  const hasRealtime = realtimePatterns.some(pat => content.includes(pat));
  
  // Look for supabase queries
  const supabaseMatches = [...content.matchAll(/supabase\s*\.\s*from\(\s*['"`]([^'"`]+)['"`]\s*\)/g)];
  const tables = [...new Set(supabaseMatches.map(m => m[1]))];
  
  // Look for useEffect or query hooks
  const hasUseEffect = content.includes('useEffect');
  const hasUseState = content.includes('useState');
  const hasSelect = content.includes('.select(');
  
  // Check if it's a UI component or page or hook
  const isComponent = (content.includes('export function') || content.includes('export const') || content.includes('export default')) && (content.includes('return (') || content.includes('return <') || filePath.endsWith('.tsx'));

  results.push({
    relPath: 'src/' + relPath,
    hasRealtime,
    tables,
    hasUseEffect,
    hasUseState,
    hasSelect,
    isComponent,
    size: content.length,
    lines: content.split('\n').length
  });
}

// Separate files into with realtime and without realtime
const withRealtime = results.filter(r => r.hasRealtime);
const withoutRealtimeWithTables = results.filter(r => !r.hasRealtime && r.tables.length > 0);

console.log(`Total files scanned: ${results.length}`);
console.log(`Files with realtime: ${withRealtime.length}`);
console.log(`Files without realtime querying tables: ${withoutRealtimeWithTables.length}`);

console.log('\n--- Files without realtime querying supabase tables ---');
for (const item of withoutRealtimeWithTables) {
  console.log(`${item.relPath} | Tables: ${item.tables.join(', ')} | Component: ${item.isComponent} | Lines: ${item.lines}`);
}
