/**
 * Prototype verification script for testing logic
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../..');
const webAdminDir = path.join(rootDir, 'src/components/admin');
const mobileDir = path.join(rootDir, 'gsa-admin-mobile');
const mobileScreensDir = path.join(mobileDir, 'src/screens');
const appTsxPath = path.join(mobileDir, 'App.tsx');

console.log('Root dir:', rootDir);
console.log('Web Admin dir exists:', fs.existsSync(webAdminDir));
console.log('Mobile dir exists:', fs.existsSync(mobileDir));
console.log('App.tsx exists:', fs.existsSync(appTsxPath));

// Read root web admin tsx files
const rootWebComponents = fs.readdirSync(webAdminDir)
  .filter(f => f.endsWith('.tsx') && !f.includes('.bak'));

console.log('Root web components count:', rootWebComponents.length);

// Read App.tsx content
const appTsxContent = fs.readFileSync(appTsxPath, 'utf8');

// Check matches
const report = rootWebComponents.map(comp => {
  const baseName = comp.replace(/\.tsx$/, '');
  
  // Possible mobile screen names
  const candidates = [
    baseName,
    baseName + 'Screen',
    baseName.replace(/Module$/, '') + 'Screen',
    baseName.replace(/AdminPanel$/, '') + 'Screen',
    baseName.replace(/Page$/, '') + 'Screen'
  ];
  
  // Check if imported in App.tsx
  const isImported = candidates.some(cand => {
    const importRegex = new RegExp(`\\b${cand}\\b`);
    return importRegex.test(appTsxContent);
  });
  
  // Check if routed in App.tsx
  const isRouted = candidates.some(cand => {
    const renderRegex = new RegExp(`<${cand}\\b`);
    return renderRegex.test(appTsxContent);
  });

  return {
    webComponent: comp,
    baseName,
    isImported,
    isRouted
  };
});

const importedCount = report.filter(r => r.isImported).length;
const routedCount = report.filter(r => r.isRouted).length;
console.log(`Current Status: Imported: ${importedCount}/${rootWebComponents.length}, Routed: ${routedCount}/${rootWebComponents.length}`);
