const fs = require('fs');
const path = require('path');

const directories = [
  'src/components/admin',
  'src/components/client',
  'src/lib',
  'src/contexts'
];

let report = '# Relatório Adicional de UI/UX (Responsividade e Formulários)\n\n';

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      analyzeFile(fullPath);
    }
  }
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  let hasResponsiveClasses = false;
  let hasZodValidation = false;
  let formTags = 0;
  let unvalidatedForms = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check responsividade
    if (line.match(/\b(sm:|md:|lg:|xl:|2xl:)/)) {
      hasResponsiveClasses = true;
    }

    // Check Zod
    if (line.includes('zod') || line.includes('z.')) {
      hasZodValidation = true;
    }

    // Check onSubmit
    if (line.includes('<form') || line.includes('onSubmit={')) {
      formTags++;
      // simple heuristic
      if (!content.includes('zod') && !content.includes('yup') && !content.includes('react-hook-form')) {
        unvalidatedForms.push(i + 1);
      }
    }
  }

  if (formTags > 0 || !hasResponsiveClasses) {
    if (!hasResponsiveClasses || unvalidatedForms.length > 0) {
      report += `### \`${filePath.replace(/\\/g, '/')}\`\n`;
      if (!hasResponsiveClasses && filePath.endsWith('.tsx')) {
        report += `- **Alerta de UI/UX:** Nenhuma classe responsiva Tailwind encontrada (sm:, md:, lg:).\n`;
      }
      if (unvalidatedForms.length > 0) {
        report += `- **Alerta de Formulários:** Formulários encontrados nas linhas ${unvalidatedForms.join(', ')} sem uso de bibliotecas de validação robustas (Zod/Yup).\n`;
      }
      report += '\n';
    }
  }
}

for (const dir of directories) {
  scanDirectory(dir);
}

fs.writeFileSync('audit_ui_ux.md', report);
console.log('Auditoria UI/UX concluída.');
