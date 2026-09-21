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

const serviceFiles = files.filter(f => {
  const norm = f.replace(/\\/g, '/');
  return norm.includes('/services/') || norm.includes('/features/') || norm.includes('/lib/') || norm.includes('/utils/');
});

console.log('Service/Lib files count:', serviceFiles.length);

const serviceUsages = [];

for (const sFile of serviceFiles) {
  const sContent = fs.readFileSync(sFile, 'utf8');
  const sRel = path.relative(path.resolve(__dirname, '../..'), sFile).replace(/\\/g, '/');
  const sTables = [...new Set([...sContent.matchAll(/supabase\s*(?:\.\s*schema\([^)]+\))?\s*\.\s*from\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map(m => m[1]))];
  
  if (sTables.length > 0) {
    const baseName = path.basename(sFile, path.extname(sFile));
    const importedBy = [];
    for (const compFile of files) {
      if (compFile === sFile) continue;
      const cContent = fs.readFileSync(compFile, 'utf8');
      if (cContent.includes(baseName)) {
        const cRel = path.relative(path.resolve(__dirname, '../..'), compFile).replace(/\\/g, '/');
        const hasRealtime = cContent.includes('useRealtime') || cContent.includes('useRealtimeSubscription') || cContent.includes('useRealtimeTable') || cContent.includes('subscribeToTable') || cContent.includes('.channel(');
        importedBy.push({ file: cRel, hasRealtime });
      }
    }
    serviceUsages.push({
      service: sRel,
      tables: sTables,
      importedBy
    });
  }
}

serviceUsages.forEach(su => {
  const nonRtImporters = su.importedBy.filter(i => !i.hasRealtime);
  if (nonRtImporters.length > 0) {
    console.log(`\nService: ${su.service} (Tables: ${su.tables.join(', ')})`);
    console.log(`  Imported by non-realtime components: ${nonRtImporters.map(i => i.file).join(', ')}`);
  }
});
