const fs = require('fs');
const path = require('path');

const files = [
  'src/components/admin/AcessosModule.tsx',
  'src/components/admin/AffiliateAdminModule.tsx',
  'src/components/admin/CadastroModule.tsx',
  'src/components/admin/CareersAdminModule.tsx',
  'src/components/admin/ConfiguracoesModule.tsx',
  'src/components/admin/FiscalModule.tsx',
  'src/components/admin/PartnersAdminModule.tsx',
  'src/components/admin/ProtectionAdminModule.tsx',
  'src/components/admin/RelatoriosModule.tsx',
  'src/components/admin/SystemMonitorModule.tsx',
  'src/components/admin/VendasModule.tsx',
  'src/components/admin/Dashboard.tsx'
];

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const importLines = content.match(/import\s+[\s\S]*?from\s+['"][^'"]+['"]/g) || [];
  for (const line of importLines) {
    const match = line.match(/from\s+['"]([^'"]+)['"]/);
    if (match) {
      const importPath = match[1];
      if (importPath.startsWith('.')) {
        const resolved = path.resolve(path.dirname(f), importPath);
        const exists = fs.existsSync(resolved + '.ts') || 
                       fs.existsSync(resolved + '.tsx') || 
                       fs.existsSync(resolved + '/index.ts') || 
                       fs.existsSync(resolved + '/index.tsx') || 
                       fs.existsSync(resolved);
        if (!exists) {
          console.log(`Missing import in ${f} -> ${importPath}`);
        }
      }
    }
  }
}
