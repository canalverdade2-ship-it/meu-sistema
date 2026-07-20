const fs = require('fs');
const path = require('path');

const rootDir = 'src';

let report = '# Relatório do Deep Audit Protocol - FASE 3 (Arquitetura Oculta e Acessibilidade)\n\n';
report += '> [!WARNING]\n> Varredura focada em Débito Técnico Oculto: URLs Hardcoded, Falhas Críticas de Acessibilidade (A11Y), Subscrições zumbis e Débitos não resolvidos (TODOs).\n\n';

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      analyzeFile(fullPath);
    }
  }
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  let hardcodedUrls = [];
  let missingAlt = [];
  let clickableDivs = [];
  let todosFixmes = [];
  let subscribeLeaks = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 1. Hardcoded Localhost
    if (line.match(/http:\/\/(localhost|127\.0\.0\.1)/)) {
      hardcodedUrls.push(i + 1);
    }

    // 2. Missing alt in img
    if (line.includes('<img ') && !line.includes('alt=')) {
      missingAlt.push(i + 1);
    }

    // 3. Clickable Div without role="button"
    // Heuristic: <div ... onClick={...} without role="button"
    if (line.match(/<div[^>]*onClick=[^>]*>/) && !line.includes('role="button"')) {
      clickableDivs.push(i + 1);
    }

    // 4. TODO / FIXME
    if (line.match(/\/\/\s*(TODO|FIXME):/i) || line.match(/<!--\s*(TODO|FIXME):/i)) {
      todosFixmes.push(i + 1);
    }

    // 5. Subscribe without cleanup variable capturing
    // This is hard statically, but we can catch basic .subscribe() in useEffects
    // A heuristic: `.subscribe()` exists but we don't see `removeChannel` or `.unsubscribe()` in the same file
    if (line.includes('.subscribe()')) {
      if (!content.includes('.unsubscribe()') && !content.includes('.removeChannel(')) {
        subscribeLeaks.push(i + 1);
      }
    }
  }

  if (hardcodedUrls.length > 0 || missingAlt.length > 0 || clickableDivs.length > 0 || todosFixmes.length > 0 || subscribeLeaks.length > 0) {
    let fileReport = `### \`${filePath.replace(/\\/g, '/')}\`\n`;
    let hasIssues = false;

    if (hardcodedUrls.length > 0) {
      fileReport += `- **URL Local Hardcoded (Risco de quebra em PRD):** Lines ${hardcodedUrls.join(', ')}\n`;
      hasIssues = true;
    }
    if (missingAlt.length > 0) {
      fileReport += `- **Quebra de Acessibilidade (Img sem \`alt\`):** Lines ${missingAlt.slice(0,5).join(', ')}${missingAlt.length>5?'...':''}\n`;
      hasIssues = true;
    }
    if (clickableDivs.length > 0) {
      fileReport += `- **Acessibilidade Crítica (\`onClick\` em div sem \`role="button"\`):** Lines ${clickableDivs.slice(0,5).join(', ')}${clickableDivs.length>5?'...':''}\n`;
      hasIssues = true;
    }
    if (todosFixmes.length > 0) {
      fileReport += `- **Débito Técnico Abandonado (TODO/FIXME):** Lines ${todosFixmes.join(', ')}\n`;
      hasIssues = true;
    }
    if (subscribeLeaks.length > 0) {
      fileReport += `- **Memory Leak de Subscrição (Sem unsubscribe/removeChannel no arquivo):** Lines ${subscribeLeaks.join(', ')}\n`;
      hasIssues = true;
    }

    if (hasIssues) {
      report += fileReport + '\n';
    }
  }
}

scanDirectory(rootDir);

fs.writeFileSync('audit_deep_part3.md', report);
console.log('Auditoria profunda fase 3 concluída.');
