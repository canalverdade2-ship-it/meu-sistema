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

const classified = {
  hasRealtime: [],
  staticQueryComponent: [],
  staticQueryNonComponent: [],
  pureUIOrProps: []
};

const realtimeKeywords = ['useRealtime', 'useRealtimeSubscription', 'useRealtimeTable', 'subscribeToTable', 'supabase.channel', '.channel('];

for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(path.resolve(__dirname, '../..'), filePath).replace(/\\/g, '/');

  const hasRealtime = realtimeKeywords.some(kw => content.includes(kw));
  const supabaseMatches = [...content.matchAll(/supabase\s*(?:\.\s*schema\([^)]+\))?\s*\.\s*from\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map(m => m[1]);
  const uniqueTables = [...new Set(supabaseMatches)];
  const isTsx = filePath.endsWith('.tsx');

  if (hasRealtime) {
    classified.hasRealtime.push({ relPath, uniqueTables, lines: content.split('\n').length });
  } else if (uniqueTables.length > 0) {
    if (isTsx || relPath.includes('hook') || relPath.includes('context')) {
      classified.staticQueryComponent.push({ relPath, uniqueTables, lines: content.split('\n').length });
    } else {
      classified.staticQueryNonComponent.push({ relPath, uniqueTables, lines: content.split('\n').length });
    }
  } else {
    classified.pureUIOrProps.push({ relPath, lines: content.split('\n').length });
  }
}

console.log('=== REALTIME STATUS SUMMARY ===');
console.log('Has Realtime:', classified.hasRealtime.length);
console.log('Static Query Components/Hooks:', classified.staticQueryComponent.length);
console.log('Static Query Services/Utils/Validation:', classified.staticQueryNonComponent.length);
console.log('Pure UI / Props / State-only files:', classified.pureUIOrProps.length);

console.log('\n--- STATIC QUERY COMPONENTS / HOOKS ---');
classified.staticQueryComponent.forEach(c => {
  console.log(`${c.relPath} -> Tables: [${c.uniqueTables.join(', ')}] (${c.lines} lines)`);
});
