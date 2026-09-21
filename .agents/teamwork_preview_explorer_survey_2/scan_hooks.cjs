const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../../src');

function getAllFiles(dir, exts = ['.ts', '.tsx']) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'tests') {
        files = files.concat(getAllFiles(full, exts));
      }
    } else if (exts.includes(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

const hookRegex = /\b(use[A-Z][a-zA-Z0-9]*)\s*\(/g;
const earlyReturnRegex = /\breturn\b\s*[^;]*;/g;

const files = getAllFiles(srcDir);
const results = {
  totalFiles: files.length,
  conditionalHooks: [],
  hookAfterReturn: [],
  realtimeWithoutFilter: [],
  realtimeWithDeps: [],
  missingKeyInMap: [],
  largeComponents: []
};

for (const file of files) {
  const relPath = path.relative(srcDir, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  
  if (lines.length > 500) {
    results.largeComponents.push({ file: relPath, lines: lines.length });
  }

  // Check early returns before hook calls
  let hasReturnStatement = false;
  let returnLine = -1;
  let componentScope = false;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check realtime hook usages
    if (line.includes('useRealtimeSubscription') || line.includes('useRealtime(')) {
      // Check if deps passed
      if (line.includes(', [') || (lines[i+1] && lines[i+1].includes('], ['))) {
        results.realtimeWithDeps.push({ file: relPath, line: lineNum, text: line.trim() });
      }
    }

    // Check conditional hooks
    const ifHookMatch = line.match(/if\s*\(.*?\)\s*\{?[^}]*\b(use[A-Z][a-zA-Z0-9]*)\s*\(/);
    if (ifHookMatch && !line.includes('useCallback') && !line.includes('useMemo') && !line.includes('useEffect')) {
      results.conditionalHooks.push({ file: relPath, line: lineNum, hook: ifHookMatch[1], text: line.trim() });
    }

    // Check map without key
    if (line.includes('.map(') && !line.includes('key=') && !line.includes('key :') && lines[i+1] && !lines[i+1].includes('key=')) {
      // simple heuristic
    }
  }
}

fs.writeFileSync(path.join(__dirname, 'hooks_scan_result.json'), JSON.stringify(results, null, 2));
console.log('Scan complete:', {
  totalFiles: results.totalFiles,
  largeComponentsCount: results.largeComponents.length,
  conditionalHooksCount: results.conditionalHooks.length,
  realtimeWithDepsCount: results.realtimeWithDeps.length
});
