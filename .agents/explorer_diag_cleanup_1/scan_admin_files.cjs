const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      getFiles(p, files);
    } else {
      files.push(p);
    }
  }
  return files;
}

const root = process.cwd();
const adminFiles = getFiles(path.join(root, 'src', 'components', 'admin'));
const allCodeFiles = [
  ...getFiles(path.join(root, 'src')),
  ...getFiles(path.join(root, 'scripts')),
  ...getFiles(path.join(root, 'tests')),
  ...getFiles(path.join(root, 'supabase')),
];

const fileContents = allCodeFiles.map(f => ({
  file: f,
  relFile: path.relative(root, f).replace(/\\/g, '/'),
  content: fs.readFileSync(f, 'utf8')
}));

console.log('Total admin files:', adminFiles.length);

const results = [];

for (const adminFile of adminFiles) {
  const relAdmin = path.relative(root, adminFile).replace(/\\/g, '/');
  const baseName = path.basename(adminFile, path.extname(adminFile));
  const fullBase = path.basename(adminFile);

  const srcRefs = [];
  const scriptRefs = [];
  const testRefs = [];
  const otherRefs = [];

  for (const { relFile, content } of fileContents) {
    if (relFile === relAdmin) continue;

    // Check if filename or import path or component name matches
    const hasPathRef = content.includes(fullBase) || content.includes(baseName);
    if (hasPathRef) {
      if (relFile.startsWith('src/tests/')) {
        testRefs.push(relFile);
      } else if (relFile.startsWith('src/')) {
        srcRefs.push(relFile);
      } else if (relFile.startsWith('scripts/')) {
        scriptRefs.push(relFile);
      } else if (relFile.startsWith('tests/')) {
        testRefs.push(relFile);
      } else {
        otherRefs.push(relFile);
      }
    }
  }

  results.push({
    file: relAdmin,
    baseName,
    srcRefsCount: srcRefs.length,
    srcRefs,
    scriptRefsCount: scriptRefs.length,
    scriptRefs,
    testRefsCount: testRefs.length,
    testRefs,
    otherRefsCount: otherRefs.length,
    otherRefs,
  });
}

fs.writeFileSync(
  path.join(root, '.agents', 'explorer_diag_cleanup_1', 'scan_results.json'),
  JSON.stringify(results, null, 2),
  'utf8'
);

const zeroSrc = results.filter(r => r.srcRefsCount === 0);
const zeroAll = results.filter(r => r.srcRefsCount === 0 && r.scriptRefsCount === 0 && r.testRefsCount === 0 && r.otherRefsCount === 0);

console.log(`Scan Complete:`);
console.log(`Total admin files: ${results.length}`);
console.log(`Files with 0 src/ references: ${zeroSrc.length}`);
console.log(`Files with 0 references anywhere: ${zeroAll.length}`);

console.log('\n--- ZERO SRC REFS (Candidate breakdown) ---');
for (const item of zeroSrc) {
  console.log(`${item.file} | Scripts: ${item.scriptRefsCount} | Tests: ${item.testRefsCount} | Other: ${item.otherRefsCount}`);
}
