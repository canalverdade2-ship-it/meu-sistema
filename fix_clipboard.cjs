const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/components/admin/AcessosModule.tsx',
  'src/components/admin/prestadores/PrestadoresCadastro.tsx',
  'src/components/client/marketplace/classifieds/ClassifiedDetailPage.tsx',
  'src/components/client/store/StoreHubCoupons.tsx',
  'src/components/prestador/PrestadorFinanceiro.tsx',
  'src/pages/Afiliado/AfiliadoDashboard.tsx'
];

filesToFix.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return;

  let content = fs.readFileSync(fullPath, 'utf-8');

  // Replace usages
  content = content.replace(/navigator\.clipboard\?\.writeText/g, 'copyToClipboard');
  content = content.replace(/navigator\.clipboard\.writeText/g, 'copyToClipboard');
  
  // also handle "if (navigator.clipboard && window.isSecureContext)" if any
  content = content.replace(/if\s*\(\s*navigator\.clipboard\s*&&\s*window\.isSecureContext\s*\)\s*\{([\s\S]*?)copyToClipboard\((.*?)\)\.then\(\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*\)(?:[\s\S]*?)\}/, "copyToClipboard($2).then((success) => { if(success) { $3 } })");
  
  // check if import exists
  if (!content.includes('copyToClipboard')) return; // nothing to do

  if (!content.includes('import { copyToClipboard }') && !content.includes('import { copyToClipboard,')) {
    // Determine relative path to lib/utils.ts
    // 1. split filePath by '/'
    const parts = filePath.split('/');
    // parts length minus 2 (src is first, then folders)
    const levels = parts.length - 2; 
    let relPath = '';
    if (levels === 0) relPath = './lib/utils';
    else if (levels === 1) relPath = '../lib/utils';
    else if (levels === 2) relPath = '../../lib/utils';
    else if (levels === 3) relPath = '../../../lib/utils';
    else if (levels === 4) relPath = '../../../../lib/utils';

    // Add import after first line or last import
    const importMatch = content.match(/^import .*?;$/m);
    if (importMatch) {
      content = content.replace(/^import (.*?);$/m, `import $1;\nimport { copyToClipboard } from '${relPath}';`);
    } else {
      content = `import { copyToClipboard } from '${relPath}';\n` + content;
    }
  }

  fs.writeFileSync(fullPath, content, 'utf-8');
  console.log(`Fixed clipboard in ${filePath}`);
});
