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

console.log('=== ANTI-PATTERN 5: UNSTABLE ONCHANGE / DEPS IN USE_REALTIME ===');

const depsFindings = [];

files.forEach(f => {
  if (f.includes('useRealtime.ts') || f.includes('supabaseRealtime.ts') || f.includes('realtime-hook.test.ts')) return;
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    if (line.includes('useRealtimeSubscription') || line.includes('useRealtime(')) {
      const windowText = lines.slice(idx, Math.min(lines.length, idx + 15)).join('\n');
      
      // Check if deps array is passed as an argument
      const hasDeps = windowText.match(/,\s*\[\s*([^\]]+)\s*\]\s*\)/);
      if (hasDeps) {
        const depsContent = hasDeps[1].trim();
        depsFindings.push({
          file: f,
          line: idx + 1,
          deps: depsContent,
          snippet: windowText.slice(0, 300)
        });
      }
    }
  });
});

console.log(`Found ${depsFindings.length} usages with explicit deps array:`);
depsFindings.forEach(d => {
  console.log(`\n${d.file}:${d.line} -> deps: [${d.deps}]`);
  console.log(d.snippet);
});
