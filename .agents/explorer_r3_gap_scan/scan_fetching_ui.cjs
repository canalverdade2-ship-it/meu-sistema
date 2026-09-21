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

const nonRealtimeComponents = [];

for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(path.resolve(__dirname, '../..'), filePath).replace(/\\/g, '/');

  const hasRealtime = content.includes('useRealtime') || content.includes('useRealtimeSubscription') || content.includes('useRealtimeTable') || content.includes('subscribeToTable') || content.includes('.channel(');
  
  if (!hasRealtime && (filePath.endsWith('.tsx') || filePath.includes('hook') || filePath.includes('context'))) {
    // Check if it fetches data (supabase or fetch or services)
    const hasSupabaseFrom = /supabase\s*(?:\.\s*schema\([^)]+\))?\s*\.\s*from\(\s*['"`]([^'"`]+)['"`]\s*\)/.test(content);
    const hasFetch = /fetch\s*\(/.test(content);
    const hasUseEffect = content.includes('useEffect');

    // Extract table names
    const tables = [...new Set([...content.matchAll(/supabase\s*(?:\.\s*schema\([^)]+\))?\s*\.\s*from\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map(m => m[1]))];

    nonRealtimeComponents.push({
      path: relPath,
      hasSupabaseFrom,
      hasFetch,
      hasUseEffect,
      tables,
      lines: content.split('\n').length
    });
  }
}

console.log(`Found ${nonRealtimeComponents.length} UI/Hook/Context files without realtime.`);

const fetchingNonRealtime = nonRealtimeComponents.filter(c => c.hasSupabaseFrom || (c.hasFetch && c.hasUseEffect));

console.log(`\nFound ${fetchingNonRealtime.length} files that fetch data without realtime:\n`);
fetchingNonRealtime.forEach(f => {
  console.log(`- ${f.path} (tables: [${f.tables.join(', ')}], fetch: ${f.hasFetch}, useEffect: ${f.hasUseEffect})`);
});
