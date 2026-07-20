const fs = require('fs');
const path = require('path');

const rootDir = 'src';

let report = '# Relatório Adicional do Deep Audit Protocol (Segurança, Performance Avançada e Overfetching)\n\n';
report += '> [!WARNING]\n> Varredura profunda focada em vulnerabilidades de Cross-Site Scripting (XSS), Overfetching de Banco de Dados, Vazamento de Chaves, e Renderização Ineficiente de Mídia.\n\n';

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    // Ignore node_modules, dist, build, etc.
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
  
  let xssRisks = [];
  let overfetchingRisks = [];
  let lazyLoadMissing = [];
  let hardcodedSecrets = [];
  let dirtyLogs = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 1. XSS (dangerouslySetInnerHTML)
    if (line.includes('dangerouslySetInnerHTML')) {
      xssRisks.push(i + 1);
    }

    // 2. Overfetching: select('*') without .limit() or pagination
    if (line.match(/\.select\(['"`]\*['"`]\)/)) {
      // Very basic check. We will flag lines with select('*') to indicate potential overfetching.
      overfetchingRisks.push(i + 1);
    }

    // 3. Lazy Load Missing: <img> without loading="lazy"
    if (line.includes('<img ') && !line.includes('loading="lazy"') && !line.includes('lazy')) {
      lazyLoadMissing.push(i + 1);
    }

    // 4. Hardcoded Secrets (sk_test, sk_live, Bearer token hardcoded)
    if (line.match(/sk_(test|live)_[a-zA-Z0-9]+/) || line.match(/Bearer\s+[A-Za-z0-9\-\._~+\/]+=*/)) {
      hardcodedSecrets.push(i + 1);
    }

    // 5. Dirty Logs (console.log)
    if (line.match(/console\.log\(/)) {
      dirtyLogs.push(i + 1);
    }
  }

  if (xssRisks.length > 0 || overfetchingRisks.length > 0 || lazyLoadMissing.length > 0 || hardcodedSecrets.length > 0 || dirtyLogs.length > 0) {
    let fileReport = `### \`${filePath.replace(/\\/g, '/')}\`\n`;
    let hasIssues = false;

    if (xssRisks.length > 0) {
      fileReport += `- **Vulnerabilidade XSS (dangerouslySetInnerHTML):** Lines ${xssRisks.join(', ')}\n`;
      hasIssues = true;
    }
    if (hardcodedSecrets.length > 0) {
      fileReport += `- **Vazamento de Chaves (Hardcoded Secret):** Lines ${hardcodedSecrets.join(', ')}\n`;
      hasIssues = true;
    }
    // Limit overfetching/dirty logs to avoid massive output spam
    if (overfetchingRisks.length > 0) {
      fileReport += `- **Overfetching (\`select('*')\` sem projeção de colunas específica):** Lines ${overfetchingRisks.slice(0,5).join(', ')}${overfetchingRisks.length>5?'...':''}\n`;
      hasIssues = true;
    }
    if (lazyLoadMissing.length > 0) {
      fileReport += `- **Carga de Imagem Não-Otimizada (Sem \`loading="lazy"\`):** Lines ${lazyLoadMissing.slice(0,5).join(', ')}${lazyLoadMissing.length>5?'...':''}\n`;
      hasIssues = true;
    }
    if (dirtyLogs.length > 0) {
      fileReport += `- **Logs em Produção (\`console.log\` poluidor):** Lines ${dirtyLogs.slice(0,5).join(', ')}${dirtyLogs.length>5?'...':''}\n`;
      hasIssues = true;
    }

    if (hasIssues) {
      report += fileReport + '\n';
    }
  }
}

scanDirectory(rootDir);

fs.writeFileSync('audit_deep_part2.md', report);
console.log('Auditoria profunda fase 2 concluída.');
