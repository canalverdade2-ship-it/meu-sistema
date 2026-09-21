const fs = require('fs');
const path = require('path');

const root = process.cwd();

// Find all ts, tsx, js, jsx files in dir
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

// Parse imports from file content
function extractImports(filePath, content) {
  const fileDir = path.dirname(filePath);
  const imports = [];

  // Match import ... from '...'; import '...'; require('...'); lazy(() => import('...'));
  const importRegex = /(?:from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1] || match[2] || match[3] || match[4];
    if (!importPath || !importPath.startsWith('.')) continue; // ignore node_modules and absolute aliases unless configured

    // Resolve relative path
    const targetBase = path.resolve(fileDir, importPath);
    // Check extensions .ts, .tsx, .js, .jsx, /index.ts, /index.tsx, etc.
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
const reverseImports = new Map(); // file -> who imports it

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

// Active entry points
const entryPoints = [
  'src/main.tsx',
  'src/App.tsx',
  'src/index.css',
  ...allSrcFiles.filter(f => f.startsWith('src/pages/')),
  ...allSrcFiles.filter(f => f.startsWith('src/routing/')),
];

// Transitive reachability from entry points
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

console.log(`Total src files: ${allSrcFiles.length}`);
console.log(`Reachable from app entry points: ${reachable.size}`);

const adminFiles = allSrcFiles.filter(f => f.startsWith('src/components/admin/'));
console.log(`Total admin files: ${adminFiles.length}`);

const reachableAdmin = adminFiles.filter(f => reachable.has(f));
const unreachableAdmin = adminFiles.filter(f => !reachable.has(f));

console.log(`Reachable admin files: ${reachableAdmin.length}`);
console.log(`Unreachable admin files (dead in runtime): ${unreachableAdmin.length}`);

// For each unreachable admin file, check references in scripts, tests, and other files
const scriptsFiles = getFiles(path.join(root, 'scripts'));
const testFiles = getFiles(path.join(root, 'src', 'tests')).concat(getFiles(path.join(root, 'tests')));
const allExternalFiles = [...scriptsFiles, ...testFiles].map(f => ({
  rel: path.relative(root, f).replace(/\\/g, '/'),
  content: fs.readFileSync(f, 'utf8')
}));

const unreachableDetails = unreachableAdmin.map(f => {
  const base = path.basename(f);
  const noExt = path.basename(f, path.extname(f));
  const importedByInSrc = reverseImports.get(f) || [];
  
  const scriptMatches = [];
  const testMatches = [];

  for (const ext of allExternalFiles) {
    if (ext.content.includes(f) || ext.content.includes(base) || ext.content.includes(noExt)) {
      if (ext.rel.startsWith('scripts/')) {
        scriptMatches.push(ext.rel);
      } else {
        testMatches.push(ext.rel);
      }
    }
  }

  return {
    file: f,
    importedByInSrc, // might be imported by other unreachable files
    scriptMatches,
    testMatches,
  };
});

fs.writeFileSync(
  path.join(root, '.agents', 'explorer_diag_cleanup_1', 'dependency_audit.json'),
  JSON.stringify({
    totalSrcFiles: allSrcFiles.length,
    totalAdminFiles: adminFiles.length,
    reachableAdminFilesCount: reachableAdmin.length,
    unreachableAdminFilesCount: unreachableAdmin.length,
    reachableAdmin,
    unreachableDetails
  }, null, 2),
  'utf8'
);

console.log('\n--- UNREACHABLE ADMIN FILES AUDIT ---');
for (const item of unreachableDetails) {
  console.log(`\nFile: ${item.file}`);
  console.log(`  Imported by (in src): ${item.importedByInSrc.length > 0 ? item.importedByInSrc.join(', ') : 'NONE (0)'}`);
  console.log(`  Referenced in scripts: ${item.scriptMatches.length > 0 ? item.scriptMatches.join(', ') : 'NONE (0)'}`);
  console.log(`  Referenced in tests: ${item.testMatches.length > 0 ? item.testMatches.join(', ') : 'NONE (0)'}`);
}
