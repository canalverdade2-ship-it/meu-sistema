const fs = require('fs');
const path = require('path');

const rootDir = 'src';

let report = '# Relatório do Deep Audit Protocol - FASE 5 (Arquitetura Monolítica, SEO e White Screen of Death)\n\n';
report += '> [!WARNING]\n> Varredura extrema focada em falhas estruturais massivas: Componentes Deus (God Components), Falta de Contenção de Erros (White Screen of Death), Anti-patterns de Estilização e Omissão de SEO.\n\n';

let globalHasErrorBoundary = false;

function scanDirectory(dir, isPageDir = false) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath, fullPath.includes('pages'));
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.jsx')) {
      analyzeFile(fullPath, isPageDir);
    }
  }
}

function analyzeFile(filePath, isPageDir) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  let inlineStylesRisks = [];
  let isGodComponent = false;
  let hasSeoTags = false;

  // Check for Error Boundaries anywhere
  if (content.includes('ErrorBoundary') || content.includes('react-error-boundary') || content.includes('componentDidCatch')) {
    globalHasErrorBoundary = true;
  }

  // Check God Component (Arbitrary limit: 800 lines for a React component is huge)
  if (lines.length > 800) {
    isGodComponent = true;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 1. Inline styles anti-pattern (bypassing Tailwind)
    if (line.match(/style=\{\{.*\}\}/) && !line.includes('transform: `translate')) {
      // filtering out dynamic transforms which are acceptable
      inlineStylesRisks.push(i + 1);
    }

    // 2. SEO in Pages
    if (isPageDir) {
      if (line.includes('<title>') || line.includes('<meta name="description"')) {
        hasSeoTags = true;
      }
    }
  }

  if (isGodComponent || inlineStylesRisks.length > 0 || (isPageDir && !hasSeoTags)) {
    let fileReport = `### \`${filePath.replace(/\\/g, '/')}\`\n`;
    let hasIssues = false;

    if (isGodComponent) {
      fileReport += `- **Anti-pattern "God Component":** Arquivo gigantesco com ${lines.length} linhas. Quebra princípios SOLID, dificulta manutenção e detona o tempo de parse do bundle.\n`;
      hasIssues = true;
    }
    if (inlineStylesRisks.length > 0) {
      fileReport += `- **Débito de Estilização (Uso de Inline Styles burlando o Tailwind):** Lines ${inlineStylesRisks.slice(0,5).join(', ')}${inlineStylesRisks.length>5?'...':''}\n`;
      hasIssues = true;
    }
    if (isPageDir && !hasSeoTags) {
      fileReport += `- **Vulnerabilidade de SEO Crítica:** Página principal não injeta tags vitais (\`<title>\`, \`<meta>\`), tornando a aplicação invisível para motores de busca estáticos.\n`;
      hasIssues = true;
    }

    if (hasIssues) {
      report += fileReport + '\n';
    }
  }
}

scanDirectory(rootDir, false);

if (!globalHasErrorBoundary) {
  report = `## 🚨 ALERTA VERMELHO MÁXIMO DE ESTABILIDADE\n**A aplicação não possui NENHUM \`ErrorBoundary\` em toda a sua estrutura.**\nIsso significa que **qualquer erro de renderização do React** em qualquer componente filho (como um dado indefinido numa tabela) **destruirá a árvore inteira do React**, resultando na temida "White Screen of Death" (Tela Branca da Morte) para o usuário final, exigindo um F5 forçado para reviver a aplicação.\n\n---\n\n` + report;
}

fs.writeFileSync('audit_deep_part5.md', report);
console.log('Auditoria profunda fase 5 concluída.');
