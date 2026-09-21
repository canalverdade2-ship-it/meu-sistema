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

const results = files.map(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(path.resolve(__dirname, '../..'), file).replace(/\\/g, '/');

  const hasUseRealtime = content.includes('useRealtime');
  const hasUseRealtimeSub = content.includes('useRealtimeSubscription');
  const hasUseRealtimeTable = content.includes('useRealtimeTable');
  const hasSubscribeToTable = content.includes('subscribeToTable');
  const hasChannel = content.includes('.channel(');
  const anyRealtime = hasUseRealtime || hasUseRealtimeSub || hasUseRealtimeTable || hasSubscribeToTable || hasChannel;

  const supabaseFrom = [...content.matchAll(/supabase\s*(?:\.\s*schema\([^)]+\))?\s*\.\s*from\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map(m => m[1]);
  const uniqueTables = [...new Set(supabaseFrom)];

  const hasUseEffect = content.includes('useEffect');
  const hasUseState = content.includes('useState');
  const isComponent = file.endsWith('.tsx') || content.includes('export function') || content.includes('export const');

  return {
    file: relPath,
    anyRealtime,
    hasUseRealtime,
    hasUseRealtimeSub,
    hasUseRealtimeTable,
    hasSubscribeToTable,
    hasChannel,
    uniqueTables,
    hasUseEffect,
    hasUseState,
    isComponent,
    lines: content.split('\n').length
  };
});

console.log('=== SUMMARY ===');
console.log('Total files in src:', results.length);
console.log('Files with ANY Realtime:', results.filter(r => r.anyRealtime).length);
console.log('Files with Supabase queries but NO Realtime:', results.filter(r => !r.anyRealtime && r.uniqueTables.length > 0).length);

console.log('\n=== BREAKDOWN OF NO REALTIME BUT QUERIES SUPABASE ===');
results.filter(r => !r.anyRealtime && r.uniqueTables.length > 0).forEach(r => {
  console.log(`${r.file} | Tables: ${r.uniqueTables.join(', ')} | useEffect: ${r.hasUseEffect} | lines: ${r.lines}`);
});
