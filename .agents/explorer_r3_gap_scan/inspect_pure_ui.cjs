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

const pureUI = [];

for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(path.resolve(__dirname, '../..'), filePath).replace(/\\/g, '/');

  const hasRealtime = realtimeKeywords.some(kw => content.includes(kw));
  const hasSupabase = content.includes('supabase');

  if (!hasRealtime && !hasSupabase && filePath.endsWith('.tsx')) {
    pureUI.push({
      path: relPath,
      lines: content.split('\n').length
    });
  }
}

console.log('Total pure UI / prop-driven TSX files:', pureUI.length);
console.log('\nTop 30 largest pure UI files (by line count):');
pureUI.sort((a, b) => b.lines - a.lines).slice(0, 30).forEach(f => {
  console.log(`- ${f.path} (${f.lines} lines)`);
});
