/**
 * Automated Parity Verification Script
 * Validates that all Web Admin components in src/components/admin/
 * have corresponding mobile screens in gsa-admin-mobile/src/screens/
 * and are imported and routed in gsa-admin-mobile/App.tsx.
 */

const fs = require('fs');
const path = require('path');

// Determine directories whether run from repo root or gsa-admin-mobile
let repoRoot = process.cwd();
if (fs.existsSync(path.join(repoRoot, 'src', 'components', 'admin'))) {
  // Already in repo root
} else if (fs.existsSync(path.join(repoRoot, '..', 'src', 'components', 'admin'))) {
  repoRoot = path.resolve(repoRoot, '..');
} else {
  console.error('Error: Could not locate repo root with src/components/admin');
  process.exit(1);
}

const webAdminDir = path.join(repoRoot, 'src', 'components', 'admin');
const mobileDir = path.join(repoRoot, 'gsa-admin-mobile');
const mobileScreensDir = path.join(mobileDir, 'src', 'screens');
const appTsxPath = path.join(mobileDir, 'App.tsx');

if (!fs.existsSync(webAdminDir)) {
  console.error(`Error: Web admin directory not found: ${webAdminDir}`);
  process.exit(1);
}

if (!fs.existsSync(appTsxPath)) {
  console.error(`Error: App.tsx not found: ${appTsxPath}`);
  process.exit(1);
}

// Helper to recursively collect files
function getFilesRecursively(dir, ext = '.tsx') {
  if (!fs.existsSync(dir)) return [];
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, ext));
    } else if (file.endsWith(ext) && !file.includes('.bak')) {
      results.push(fullPath);
    }
  }
  return results;
}

// 1. Collect Web Admin Modules (root modules are primary admin targets)
const rootWebComponents = fs.readdirSync(webAdminDir)
  .filter(f => f.endsWith('.tsx') && !f.includes('.bak'))
  .sort();

// Collect all mobile screen files (recursive search in src/screens)
const mobileScreenFiles = fs.existsSync(mobileScreensDir) 
  ? getFilesRecursively(mobileScreensDir, '.tsx')
  : [];

// Read App.tsx content
const appTsxContent = fs.readFileSync(appTsxPath, 'utf8');

console.log('='.repeat(80));
console.log(' GSA ERP -> MOBILE PARITY VERIFICATION REPORT');
console.log('='.repeat(80));
console.log(`Web Admin Directory:   ${webAdminDir}`);
console.log(`Mobile Screens Dir:    ${mobileScreensDir}`);
console.log(`Mobile App.tsx:        ${appTsxPath}`);
console.log(`Total Web Components:  ${rootWebComponents.length}`);
console.log(`Mobile Screens Found:  ${mobileScreenFiles.length}`);
console.log('-'.repeat(80));

let passCount = 0;
let failCount = 0;
const results = [];

for (const comp of rootWebComponents) {
  const baseName = comp.replace(/\.tsx$/, '');
  
  // Possible mobile screen file names
  const candidateNames = [
    `${baseName}.tsx`,
    `${baseName}Screen.tsx`,
    `${baseName.replace(/Module$/, '')}Screen.tsx`,
    `${baseName.replace(/AdminPanel$/, '')}Screen.tsx`,
    `${baseName.replace(/Page$/, '')}Screen.tsx`
  ];

  // Also candidate component identifiers in code
  const candidateIdentifiers = [
    baseName,
    `${baseName}Screen`,
    `${baseName.replace(/Module$/, '')}Screen`,
    `${baseName.replace(/AdminPanel$/, '')}Screen`,
    `${baseName.replace(/Page$/, '')}Screen`
  ];

  // 1. Check if corresponding mobile screen file exists
  let screenFileFound = null;
  for (const mFile of mobileScreenFiles) {
    const filename = path.basename(mFile);
    if (candidateNames.includes(filename)) {
      screenFileFound = path.relative(mobileDir, mFile);
      break;
    }
  }

  // 2. Check if imported in App.tsx
  let isImported = false;
  let matchedIdentifier = null;
  for (const ident of candidateIdentifiers) {
    // Check regex: imported from screens or direct file
    const importRegex = new RegExp(`\\bimport\\s+[^;]*?\\b${ident}\\b[^;]*?from`);
    const generalImportRegex = new RegExp(`\\b${ident}\\b`);
    if (importRegex.test(appTsxContent) || (appTsxContent.includes(ident) && generalImportRegex.test(appTsxContent))) {
      isImported = true;
      matchedIdentifier = ident;
      break;
    }
  }

  // 3. Check if routed in App.tsx
  // Routing can be: <MatchedIdentifier .../> or component={MatchedIdentifier} or Screen name=...
  let isRouted = false;
  if (matchedIdentifier) {
    const jsxRegex = new RegExp(`<${matchedIdentifier}\\b`);
    const compPropRegex = new RegExp(`component=\\{?\\s*${matchedIdentifier}\\s*\\}?`);
    if (jsxRegex.test(appTsxContent) || compPropRegex.test(appTsxContent)) {
      isRouted = true;
    }
  }

  const isComplete = screenFileFound && isImported && isRouted;
  if (isComplete) {
    passCount++;
  } else {
    failCount++;
  }

  results.push({
    webComponent: comp,
    screenFile: screenFileFound || 'MISSING',
    imported: isImported ? 'YES' : 'NO',
    routed: isRouted ? 'YES' : 'NO',
    status: isComplete ? 'PASS' : 'FAIL'
  });
}

// Print Results Table
console.log(
  'Web Component'.padEnd(35) +
  'Screen File'.padEnd(25) +
  'Import'.padEnd(10) +
  'Routed'.padEnd(10) +
  'Status'
);
console.log('-'.repeat(85));

for (const res of results) {
  const line = 
    res.webComponent.padEnd(35) +
    (res.screenFile.length > 23 ? res.screenFile.substring(0, 20) + '...' : res.screenFile).padEnd(25) +
    res.imported.padEnd(10) +
    res.routed.padEnd(10) +
    (res.status === 'PASS' ? '✅ PASS' : '❌ FAIL');
  console.log(line);
}

console.log('='.repeat(80));
console.log(`TOTAL WEB COMPONENTS: ${rootWebComponents.length}`);
console.log(`PASSED:               ${passCount}`);
console.log(`FAILED / PENDING:     ${failCount}`);
console.log(`PARITY RATE:          ${((passCount / rootWebComponents.length) * 100).toFixed(1)}%`);
console.log('='.repeat(80));

if (failCount > 0) {
  console.log('\n❌ VERIFICATION FAILED: Some web admin components lack mobile screens or routing.');
  // Do not exit with 1 during dry run if flag --allow-fail passed
  if (!process.argv.includes('--allow-fail')) {
    process.exit(1);
  }
} else {
  console.log('\n✅ VERIFICATION PASSED: 100% parity achieved! All components mapped and routed.');
  process.exit(0);
}
