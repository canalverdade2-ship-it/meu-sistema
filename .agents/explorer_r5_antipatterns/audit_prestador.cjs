const fs = require('fs');
const path = require('path');

const prestadorDir = 'src/components/prestador';
const files = fs.readdirSync(prestadorDir).filter(f => f.endsWith('.tsx'));

files.forEach(file => {
  const filePath = path.join(prestadorDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`\n========================================`);
  console.log(`FILE: ${file}`);
  console.log(`========================================`);
  
  const hasUseRealtime = content.includes('useRealtime');
  const hasDirectChannel = content.includes('supabase.channel');
  console.log(`Uses useRealtime: ${hasUseRealtime}, Uses direct channel: ${hasDirectChannel}`);

  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('.channel(') || line.includes('useRealtime') || line.includes('removeChannel') || line.includes('unsubscribe()')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  });
});
