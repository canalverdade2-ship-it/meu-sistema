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

console.log('=== DEEP DIVE: REALTIME IN MODALS / DRAWERS / INACTIVE COMPONENTS ===');

const modalFindings = [];

files.forEach(f => {
  const base = path.basename(f);
  const isModalOrDrawer = base.toLowerCase().includes('modal') || base.toLowerCase().includes('drawer') || base.toLowerCase().includes('dialog') || base.toLowerCase().includes('wizard');
  
  const content = fs.readFileSync(f, 'utf8');
  const hasRealtime = content.includes('useRealtimeSubscription') || content.includes('useRealtime(') || content.includes('useRealtimeTable') || content.includes('.channel(');

  if (isModalOrDrawer && hasRealtime) {
    const lines = content.split('\n');
    const hasEnabledProp = content.includes('enabled:');
    const hasIsOpenProp = content.includes('isOpen') || content.includes('open') || content.includes('visible');
    
    // Find lines with realtime
    const rtLines = [];
    lines.forEach((line, idx) => {
      if (line.includes('useRealtime') || line.includes('.channel(')) {
        rtLines.push({ lineNum: idx + 1, text: line.trim() });
      }
    });

    modalFindings.push({
      file: f,
      name: base,
      hasEnabledProp,
      hasIsOpenProp,
      rtLines,
      snippet: lines.slice(0, 100).join('\n')
    });
  }
});

console.log(`Found ${modalFindings.length} Modal/Drawer components with Realtime:`);
modalFindings.forEach(m => {
  console.log(`\n----------------------------------------`);
  console.log(`Component: ${m.name} (${m.file})`);
  console.log(`Has enabled prop in hook: ${m.hasEnabledProp}`);
  m.rtLines.forEach(l => console.log(`  Line ${l.lineNum}: ${l.text}`));
});

fs.writeFileSync('.agents/explorer_r5_antipatterns/modal_realtime_findings.json', JSON.stringify(modalFindings, null, 2));
