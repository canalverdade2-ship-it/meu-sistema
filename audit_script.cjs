const fs = require('fs');
const path = require('path');

const directories = [
  'src/components/admin',
  'src/components/client',
  'src/lib',
  'src/contexts'
];

let report = '# Relatório de Auditoria Profunda Automática\n\n';

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
  
  let emptyCatches = [];
  let nPlusOneQueries = [];
  let mathConversions = [];
  
  let inForLoop = false;
  let forLoopBrackets = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check empty catch
    if (line.match(/catch\s*\([^)]*\)\s*\{\s*\}/)) {
      emptyCatches.push(i + 1);
    } else if (line.match(/catch\s*\{/)) {
      if (lines[i+1] && lines[i+1].trim() === '}') {
        emptyCatches.push(i + 1);
      }
    }

    // Check N+1 queries (await supabase inside loop)
    if (line.match(/for\s*\(/)) {
      inForLoop = true;
      forLoopBrackets = 1;
    }
    if (inForLoop && line.includes('{')) forLoopBrackets++;
    if (inForLoop && line.includes('}')) forLoopBrackets--;
    if (inForLoop && forLoopBrackets <= 0) inForLoop = false;
    
    if (inForLoop && line.includes('await supabase')) {
      nPlusOneQueries.push(i + 1);
    }

    // Check Math Conversions (Number, parseFloat, *, /)
    if (line.includes('Number(') || line.includes('parseFloat(') || line.includes(' / ') || line.includes(' * ')) {
      mathConversions.push(i + 1);
    }
  }

  if (emptyCatches.length > 0 || nPlusOneQueries.length > 0 || mathConversions.length > 0) {
    report += `### \`${filePath.replace(/\\/g, '/')}\`\n`;
    if (emptyCatches.length > 0) report += `- **Empty Catches:** Lines ${emptyCatches.join(', ')}\n`;
    if (nPlusOneQueries.length > 0) report += `- **N+1 Queries:** Lines ${nPlusOneQueries.join(', ')}\n`;
    // Only report first 5 math conversions to avoid spam
    if (mathConversions.length > 0) report += `- **Math/Conversions (Amostra):** Lines ${mathConversions.slice(0, 5).join(', ')}${mathConversions.length > 5 ? ' e mais...' : ''}\n`;
    report += '\n';
  }
}

if (fs.existsSync('src/types.ts')) analyzeFile('src/types.ts');

for (const dir of directories) {
  scanDirectory(dir);
}

fs.writeFileSync('audit_report.md', report);
console.log('Auditoria automática concluída com sucesso.');
