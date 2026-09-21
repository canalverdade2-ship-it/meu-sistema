const fs = require('fs');
const path = require('path');

const root = process.cwd();

function getFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      getFiles(p, files);
    } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(file)) {
      files.push(p);
    }
  }
  return files;
}

function extractImports(filePath, content) {
  const fileDir = path.dirname(filePath);
  const imports = [];
  const importRegex = /(?:from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1] || match[2] || match[3] || match[4];
    if (!importPath || !importPath.startsWith('.')) continue;

    const targetBase = path.resolve(fileDir, importPath);
    const candidates = [
      targetBase,
      targetBase + '.ts',
      targetBase + '.tsx',
      targetBase + '.js',
      targetBase + '.jsx',
      path.join(targetBase, 'index.ts'),
      path.join(targetBase, 'index.tsx'),
      path.join(targetBase, 'index.js'),
      path.join(targetBase, 'index.jsx'),
    ];

    let resolved = null;
    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        resolved = cand;
        break;
      }
    }

    if (resolved) {
      imports.push(path.relative(root, resolved).replace(/\\/g, '/'));
    }
  }
  return imports;
}

const allSrcFiles = getFiles(path.join(root, 'src')).map(f => path.relative(root, f).replace(/\\/g, '/'));
const reverseImports = new Map();

for (const relFile of allSrcFiles) {
  const fullPath = path.join(root, relFile);
  const content = fs.readFileSync(fullPath, 'utf8');
  const imps = extractImports(fullPath, content);
  
  for (const imp of imps) {
    if (!reverseImports.has(imp)) {
      reverseImports.set(imp, []);
    }
    reverseImports.get(imp).push(relFile);
  }
}

const audit = JSON.parse(fs.readFileSync(path.join(root, '.agents', 'explorer_diag_cleanup_1', 'dependency_audit.json'), 'utf8'));
const topLevelReachable = audit.reachableAdmin.filter(f => path.dirname(f) === 'src/components/admin');

console.log('Top level reachable admin files:');
for (const f of topLevelReachable) {
  const imps = reverseImports.get(f) || [];
  console.log(`\n${f}`);
  console.log(`  Imported by (${imps.length}): ${imps.join(', ')}`);
}
