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

const directChannelAudit = [];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (!content.includes('.channel(')) return;

  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    if (line.includes('.channel(')) {
      // Find enclosing useEffect or function block
      const startLine = Math.max(0, idx - 10);
      const endLine = Math.min(lines.length, idx + 45);
      const block = lines.slice(startLine, endLine).join('\n');

      const hasRemoveChannel = block.includes('removeChannel') || content.includes('removeChannel');
      const hasUnsubscribeOnly = block.includes('.unsubscribe()') && !block.includes('removeChannel');
      const hasNoCleanup = !block.includes('return () =>') && !block.includes('return () => {');

      const channelNameMatch = line.match(/\.channel\(([^)]+)\)/);
      const channelNameExpr = channelNameMatch ? channelNameMatch[1].trim() : 'unknown';

      const isUnstableName = channelNameExpr.includes('Date.now()') || channelNameExpr.includes('Math.random()');

      // Check tables subscribed in this channel
      const onMatches = [];
      const onRegex = /\.on\(\s*['"]postgres_changes['"],\s*({[^}]+})/g;
      let m;
      while ((m = onRegex.exec(block)) !== null) {
        onMatches.push(m[1]);
      }

      directChannelAudit.push({
        file: f,
        line: idx + 1,
        channelNameExpr,
        isUnstableName,
        hasRemoveChannel,
        hasUnsubscribeOnly,
        hasNoCleanup,
        blockSnippet: lines.slice(idx, Math.min(lines.length, idx + 15)).join('\n'),
        onMatches
      });
    }
  });
});

console.log('Total direct channels found:', directChannelAudit.length);
fs.writeFileSync('.agents/explorer_r5_antipatterns/direct_channels.json', JSON.stringify(directChannelAudit, null, 2));

console.log('\n--- DIRECT CHANNELS WITH ISSUES ---');
directChannelAudit.forEach(dc => {
  const issues = [];
  if (dc.isUnstableName) issues.push('UNSTABLE_NAME (Date.now/Math.random)');
  if (!dc.hasRemoveChannel) issues.push('NO_REMOVE_CHANNEL (Missing supabase.removeChannel)');
  if (dc.hasUnsubscribeOnly) issues.push('UNSUBSCRIBE_ONLY (Deprecated channel.unsubscribe)');
  if (dc.hasNoCleanup) issues.push('NO_CLEANUP_RETURN');

  if (issues.length > 0) {
    console.log(`\n🔴/🟡 ${dc.file}:${dc.line} [${issues.join(', ')}]`);
    console.log(`Channel: ${dc.channelNameExpr}`);
    console.log(dc.blockSnippet);
  }
});
