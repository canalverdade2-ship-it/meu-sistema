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

console.log('=== DETAILED AUDIT OF REALTIME CALLS ===');

const report = [];

files.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Check 1: Direct supabase.channel()
  if (content.includes('.channel(')) {
    lines.forEach((line, idx) => {
      if (line.includes('.channel(')) {
        // Check if there is cleanup in the same useEffect or file
        const snippet = lines.slice(Math.max(0, idx - 5), Math.min(lines.length, idx + 25)).join('\n');
        const hasRemoveChannel = snippet.includes('removeChannel') || content.includes('removeChannel');
        const hasUnsubscribe = snippet.includes('.unsubscribe()');
        const isUnstableName = line.includes('Date.now()') || line.includes('Math.random()');

        report.push({
          file: filePath,
          line: idx + 1,
          type: 'DIRECT_CHANNEL',
          hasRemoveChannel,
          hasUnsubscribe,
          isUnstableName,
          raw: line.trim(),
          context: snippet
        });
      }
    });
  }

  // Check 2: useRealtimeTable
  if (content.includes('useRealtimeTable(')) {
    lines.forEach((line, idx) => {
      if (line.includes('useRealtimeTable(')) {
        report.push({
          file: filePath,
          line: idx + 1,
          type: 'DEPRECATED_HOOK_USE_REALTIME_TABLE',
          raw: line.trim()
        });
      }
    });
  }

  // Check 3: useRealtimeSubscription / useRealtime without filter on tenant/user tables
  if (content.includes('useRealtimeSubscription') || content.includes('useRealtime(')) {
    lines.forEach((line, idx) => {
      if ((line.includes('useRealtimeSubscription') || line.includes('useRealtime(')) && !line.startsWith('import')) {
        const snippet = lines.slice(idx, Math.min(lines.length, idx + 30)).join('\n');
        report.push({
          file: filePath,
          line: idx + 1,
          type: 'USE_REALTIME_USAGE',
          raw: line.trim(),
          snippet
        });
      }
    });
  }
});

console.log('Total report items:', report.length);
fs.writeFileSync('.agents/explorer_r5_antipatterns/raw_report.json', JSON.stringify(report, null, 2));
console.log('Saved raw_report.json');
