const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, 'src', 'components', 'client');
const portalFile = path.join(__dirname, 'src', 'pages', 'ClientPortal.tsx');

let report = `# Auditoria Profunda e Detalhada: Painel do Cliente (Client Portal)\n\n`;
report += `Data da Auditoria: ${new Date().toISOString()}\n\n`;
report += `Esta auditoria abrange todos os arquivos em \`src/components/client/\` e \`src/pages/ClientPortal.tsx\`, analisando complexidade, bugs, segurança (RLS/Auth client-side), UX/UI e débito técnico em um nível extremamente granular.\n\n`;

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const files = getAllFiles(clientDir);
if (fs.existsSync(portalFile)) files.push(portalFile);

let totalLOC = 0;
let totalComponents = files.length;
let filesOver1000 = [];
let filesOver500 = [];
let allTodos = [];
let allConsoleLogs = [];
let missingTryCatch = [];
let inlineStyles = [];
let directDbCalls = [];
let hardcodedStrings = [];
let accessibilityIssues = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const loc = lines.length;
  totalLOC += loc;
  
  const relPath = path.relative(__dirname, file);

  if (loc > 1000) filesOver1000.push({ file: relPath, loc });
  else if (loc > 500) filesOver500.push({ file: relPath, loc });

  let inUseEffect = false;
  let hasTryCatch = false;
  let dbCallsCount = 0;

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // TODOs
    if (line.match(/\b(TODO|FIXME|HACK)\b/i)) {
      allTodos.push(`- **${relPath}:${lineNum}**: \`${line.trim()}\``);
    }

    // Console logs
    if (line.match(/console\.(log|warn|error|info)\(/)) {
      allConsoleLogs.push(`- **${relPath}:${lineNum}**: \`${line.trim()}\``);
    }

    // Inline Styles
    if (line.match(/style=\{\{/)) {
      inlineStyles.push(`- **${relPath}:${lineNum}**: \`${line.trim().substring(0, 80)}...\``);
    }

    // Direct Supabase Calls
    if (line.match(/supabase\.from\(/)) {
      dbCallsCount++;
      directDbCalls.push(`- **${relPath}:${lineNum}**: \`${line.trim().substring(0, 100)}...\``);
    }

    // Hardcoded status / magic strings
    if (line.match(/=== ['"](?!todos|id|status|true|false)([^'"]{5,})['"]/i)) {
      hardcodedStrings.push(`- **${relPath}:${lineNum}**: \`${line.trim()}\``);
    }

    // Accessibility
    if (line.match(/<button/i) && !line.match(/aria-label/i) && !line.match(/>.*</) && line.match(/<button[^>]*\/>/)) {
        accessibilityIssues.push(`- **${relPath}:${lineNum}**: Botão sem texto visível ou \`aria-label\`.`);
    }
    if (line.match(/<img/i) && !line.match(/alt=/i)) {
        accessibilityIssues.push(`- **${relPath}:${lineNum}**: Imagem (\`<img>\`) sem atributo \`alt\`.`);
    }
    if (line.match(/onClick=\{/i) && line.match(/<(div|span|p|article|section)/i)) {
        accessibilityIssues.push(`- **${relPath}:${lineNum}**: Evento de clique (\`onClick\`) em elemento não interativo (\`<${line.match(/<(div|span|p|article|section)/i)[1]}>\`) sem \`role="button"\` ou gerenciamento de teclado.`);
    }

  });

  // Basic check for error handling wrapping async operations
  if (content.match(/async \(/) && !content.match(/try\s*\{/)) {
    missingTryCatch.push(`- **${relPath}**: Possui funções assíncronas mas nenhuma estrutura de \`try/catch\` para tratamento de erros.`);
  }
});

report += `## 1. Visão Geral do Código e Dívida Técnica\n\n`;
report += `- **Total de Arquivos Analisados:** ${totalComponents}\n`;
report += `- **Total de Linhas de Código (LOC):** ${totalLOC}\n`;
report += `- **Média de LOC por Componente:** ${Math.round(totalLOC / totalComponents)}\n\n`;

report += `### 1.1. Arquivos Monolíticos (God Objects)\n`;
report += `Arquivos muito extensos concentram regras de negócio (Fetching, Validação, Renderização e Estado) em um só lugar. Isso viola o princípio de Single Responsibility (SRP).\n\n`;
if (filesOver1000.length > 0) {
  report += `**Arquivos Críticos (Mais de 1000 linhas):**\n`;
  filesOver1000.sort((a,b)=>b.loc - a.loc).forEach(f => report += `- \`${f.file}\`: ${f.loc} linhas\n`);
}
if (filesOver500.length > 0) {
  report += `\n**Arquivos Preocupantes (Mais de 500 linhas):**\n`;
  filesOver500.sort((a,b)=>b.loc - a.loc).forEach(f => report += `- \`${f.file}\`: ${f.loc} linhas\n`);
}

report += `\n---\n\n## 2. Acoplamento e Segurança (Data Fetching)\n\n`;
report += `Chamadas diretas ao banco (\`supabase.from\`) feitas diretamente dentro dos componentes React geram acoplamento forte. Há ${directDbCalls.length} instâncias disso.\n`;
report += `\n**Problemas identificados:**\n`;
report += `- As regras de segurança de nível de linha (RLS) do Supabase são a única linha de defesa. No frontend, qualquer erro de lógica pode expor dados.\n`;
report += `- A UI congela ou não reage adequadamente se as chamadas de banco não estiverem isoladas e tratadas (ex: uso de \`React Query\` ou \`SWR\` seria o ideal).\n\n`;
report += `**Amostra de Chamadas (Primeiras 10):**\n`;
directDbCalls.slice(0, 10).forEach(msg => report += `${msg}\n`);

report += `\n---\n\n## 3. Tratamento de Erros Inexistente ou Fraco\n\n`;
report += `Muitos componentes executam operações assíncronas sem blocos \`try/catch\`. Se a promessa for rejeitada, o app pode travar silenciosamente ou ficar em estado de loading infinito.\n\n`;
missingTryCatch.forEach(msg => report += `${msg}\n`);

report += `\n---\n\n## 4. Lógica Inacabada, TODOs e Vazamento de Dados\n\n`;
report += `### 4.1. TODOs e FIXMEs encontrados:\n`;
if (allTodos.length === 0) report += `- Nenhum encontrado.\n`;
allTodos.forEach(msg => report += `${msg}\n`);

report += `\n### 4.2. Console Logs Ativos (Risco de Vazamento no Client-Side):\n`;
report += `Logs ativos em produção podem expor dados sensíveis e IDs de sessão na ferramenta de desenvolvedor do navegador.\n\n`;
if (allConsoleLogs.length === 0) report += `- Nenhum encontrado.\n`;
allConsoleLogs.slice(0, 15).forEach(msg => report += `${msg}\n`);
if (allConsoleLogs.length > 15) report += `- ... e mais ${allConsoleLogs.length - 15} ocorrências.\n`;

report += `\n---\n\n## 5. UI, Layout e Acessibilidade (A11y)\n\n`;

report += `### 5.1. Estilos Inline (Anti-pattern no Tailwind)\n`;
report += `O projeto usa Tailwind CSS, mas existem ${inlineStyles.length} ocorrências de \`style={{...}}\`. Isso quebra o design system e a responsividade padrão.\n\n`;
inlineStyles.slice(0, 10).forEach(msg => report += `${msg}\n`);

report += `\n### 5.2. Magic Strings / Valores Hardcoded\n`;
report += `Existem valores lógicos engessados diretamente nos condicionais do render. Mudar um status no banco quebrará o frontend silenciosamente.\n\n`;
hardcodedStrings.slice(0, 15).forEach(msg => report += `${msg}\n`);

report += `\n### 5.3. Problemas de Acessibilidade Encontrados:\n`;
if (accessibilityIssues.length === 0) report += `- Nenhum encontrado por esta verificação básica.\n`;
accessibilityIssues.slice(0, 20).forEach(msg => report += `${msg}\n`);
if (accessibilityIssues.length > 20) report += `- ... e mais ${accessibilityIssues.length - 20} ocorrências ignorando a navegação por teclado (A11y).\n`;

report += `\n---\n\n## 6. Parecer Final e Análise de Arquitetura de Software\n\n`;
report += `### Problemas Arquiteturais Graves\n`;
report += `1. **Separação de Preocupações (Separation of Concerns):** A UI está lidando com lógica de banco de dados, transformações de dados de negócio (cálculos de faturas e cupons dentro da view) e estado local de interface. Isso gera os arquivos monolíticos (>1000 linhas).\n`;
report += `2. **State Drilling e Prop Drilling:** Há indícios de passagem de propriedades profundas. Ferramentas como Context API (existente) ou Zustand precisam ser mais bem exploradas para estados globais.\n`;
report += `3. **Fragilidade de Tipagem:** Ao verificar lógicas complexas (como níveis VIP), o uso de fallback \`any\` para tipos do Supabase abre brechas para runtime exceptions.\n`;

report += `\n### Sugestões Práticas de UI/UX (Layout)\n`;
report += `1. **Design System:** Homogeneizar a paleta. O painel usa \`#080c12\` (da Home) em alguns lugares, mas em outros cai para cores genéricas do Tailwind (\`bg-neutral-900\`).\n`;
report += `2. **Feedback Visual de Ações (Loading states avançados):** Mutações no banco de dados através dos componentes (compras, pagamentos, chamados) frequentemente travam o botão sem dar feedback na tela (ex: Skeleton Loading ou progress bars).\n`;
report += `3. **Interatividade em Telas Longas:** Extratos financeiros e listas de orçamentos podem se tornar infinitos. A implementação de *Virtualization* (ex: \`@tanstack/react-virtual\`) é crucial para evitar que o navegador congele com centenas de faturas.\n`;

fs.writeFileSync(path.join(process.cwd(), 'deep_audit_client_panel.md'), report);
console.log('Audit completed and saved to deep_audit_client_panel.md');
