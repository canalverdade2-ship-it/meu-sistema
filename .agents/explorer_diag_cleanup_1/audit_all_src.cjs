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
const fileImports = new Map();
const reverseImports = new Map();

for (const relFile of allSrcFiles) {
  const fullPath = path.join(root, relFile);
  const content = fs.readFileSync(fullPath, 'utf8');
  const imps = extractImports(fullPath, content);
  fileImports.set(relFile, imps);
  
  for (const imp of imps) {
    if (!reverseImports.has(imp)) {
      reverseImports.set(imp, []);
    }
    reverseImports.get(imp).push(relFile);
  }
}

// Comprehensive Entry points
const entryPoints = [
  'src/main.tsx',
  'src/App.tsx',
  ...allSrcFiles.filter(f => f.startsWith('src/pages/')),
  ...allSrcFiles.filter(f => f.startsWith('src/routing/routeMatcher') || f.startsWith('src/routing/routeCatalog') || f.startsWith('src/routing/adminAccess')),
];

const reachable = new Set();
const queue = [...entryPoints];
for (const ep of entryPoints) {
  reachable.add(ep);
}

while (queue.length > 0) {
  const curr = queue.shift();
  const imps = fileImports.get(curr) || [];
  for (const imp of imps) {
    if (!reachable.has(imp)) {
      reachable.add(imp);
      queue.push(imp);
    }
  }
}

const scriptsFiles = getFiles(path.join(root, 'scripts'));
const testFiles = getFiles(path.join(root, 'src', 'tests')).concat(getFiles(path.join(root, 'tests')));
const allExternalFiles = [...scriptsFiles, ...testFiles].map(f => ({
  rel: path.relative(root, f).replace(/\\/g, '/'),
  content: fs.readFileSync(f, 'utf8')
}));

const unreachableFiles = allSrcFiles.filter(f => !reachable.has(f));

const groupedByDir = {};
for (const file of unreachableFiles) {
  const dir = path.dirname(file);
  if (!groupedByDir[dir]) groupedByDir[dir] = [];
  
  const base = path.basename(file);
  const noExt = path.basename(file, path.extname(file));
  const importedBy = reverseImports.get(file) || [];
  
  const scriptMatches = [];
  const testMatches = [];

  for (const ext of allExternalFiles) {
    if (ext.content.includes(file) || ext.content.includes(base) || ext.content.includes(noExt)) {
      if (ext.rel.startsWith('scripts/')) {
        scriptMatches.push(ext.rel);
      } else {
        testMatches.push(ext.rel);
      }
    }
  }

  groupedByDir[dir].push({
    file,
    importedBy,
    scriptMatches,
    testMatches,
  });
}

console.log(`Total src files: ${allSrcFiles.length}`);
console.log(`Reachable files: ${reachable.size}`);
console.log(`Unreachable files: ${unreachableFiles.length}`);
console.log('\nUnreachable files by directory:');
for (const [dir, items] of Object.entries(groupedByDir)) {
  console.log(`\n=== Directory: ${dir} (${items.length} files) ===`);
  for (const it of items) {
    console.log(`  - ${it.file} [importedBy: ${it.importedBy.length}, scriptRefs: ${it.scriptMatches.length}, testRefs: ${it.testMatches.length}]`);
  }
}

fs.writeFileSync(
  path.join(root, '.agents', 'explorer_diag_cleanup_1', 'all_unreachable.json'),
  JSON.stringify(groupedByDir, null, 2),
  'utf8'
);
