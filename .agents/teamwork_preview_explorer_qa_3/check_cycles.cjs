const fs = require('fs');
const path = require('path');

function getImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const importRegex = /(?:import|export)\s+(?:(?:(?:\w+|\{[^}]*\}|\*\s+as\s+\w+)\s+from\s+)?['"]([^'"]+)['"])/g;
  const imports = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function getAllFiles(dir, exts = ['.ts', '.tsx']) {
  let files = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && item.name !== 'dist' && item.name !== '.git') {
        files = files.concat(getAllFiles(full, exts));
      }
    } else if (exts.includes(path.extname(item.name))) {
      files.push(full);
    }
  }
  return files;
}

const allSrcFiles = getAllFiles(path.resolve('src'));
const fileMap = new Map();
allSrcFiles.forEach(f => fileMap.set(path.normalize(f).toLowerCase(), f));

function resolveImport(fromFile, importPath) {
  if (importPath.startsWith('@/')) {
    const rel = importPath.replace('@/', '');
    return tryResolve(path.resolve(rel));
  }
  if (importPath.startsWith('.')) {
    const dir = path.dirname(fromFile);
    return tryResolve(path.resolve(dir, importPath));
  }
  return null;
}

function tryResolve(base) {
  const candidates = [
    base,
    base + '.ts',
    base + '.tsx',
    base + '.d.ts',
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ];
  for (const c of candidates) {
    const lower = path.normalize(c).toLowerCase();
    if (fileMap.has(lower)) return fileMap.get(lower);
  }
  return null;
}

const graph = new Map();
allSrcFiles.forEach(file => {
  const rawImports = getImports(file);
  const resolved = rawImports.map(imp => resolveImport(file, imp)).filter(Boolean);
  graph.set(file, resolved);
});

// Find cycles
const visited = new Set();
const recStack = new Set();
const cycles = [];

function dfs(node, pathStack = []) {
  visited.add(node);
  recStack.add(node);
  pathStack.push(node);

  const neighbors = graph.get(node) || [];
  for (const neighbor of neighbors) {
    if (!visited.has(neighbor)) {
      dfs(neighbor, [...pathStack]);
    } else if (recStack.has(neighbor)) {
      const cycleStart = pathStack.indexOf(neighbor);
      if (cycleStart !== -1) {
        cycles.push(pathStack.slice(cycleStart).concat(neighbor));
      }
    }
  }

  recStack.delete(node);
}

for (const file of allSrcFiles) {
  if (!visited.has(file)) {
    dfs(file);
  }
}

console.log('Total files checked:', allSrcFiles.length);
console.log('Cycles found:', cycles.length);
if (cycles.length > 0) {
  console.log('First 10 unique cycles:');
  const seen = new Set();
  let count = 0;
  for (const c of cycles) {
    const key = c.map(f => path.relative(process.cwd(), f)).sort().join(' -> ');
    if (!seen.has(key)) {
      seen.add(key);
      count++;
      console.log(`\nCycle #${count}:`);
      c.forEach(f => console.log('  -> ' + path.relative(process.cwd(), f)));
      if (count >= 10) break;
    }
  }
}
