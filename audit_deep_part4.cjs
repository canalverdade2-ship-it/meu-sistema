const fs = require('fs');
const path = require('path');

const rootDir = 'src';

let report = '# Relatório do Deep Audit Protocol - FASE 4 (Race Conditions, Antipatterns React e Tipagem Insegura)\n\n';
report += '> [!WARNING]\n> Varredura focada nas vulnerabilidades mais sutis do motor React: Submissões Duplas (Race Conditions), Chaves Dinâmicas Erradas (Bugs de Renderização), e Supressão Silenciosa de Tipagem.\n\n';

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      analyzeFile(fullPath);
    }
  }
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  let keyIndexRisks = [];
  let tsIgnoreRisks = [];
  let doubleSubmissionRisks = [];
  let zIndexHell = [];
  let unmountedSetStateRisks = []; // Effect fetching data but without mounted check

  let inUseEffect = false;
  let useEffectBrackets = 0;
  let hasMountedCheck = false;
  let hasAsyncInEffect = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 1. key={index} or key={idx}
    if (line.match(/key=\{[a-zA-Z]*(index|idx)\}/)) {
      keyIndexRisks.push(i + 1);
    }

    // 2. @ts-ignore
    if (line.includes('@ts-ignore') || line.includes('eslint-disable-next-line')) {
      tsIgnoreRisks.push(i + 1);
    }

    // 3. Double Submission (Button onClick async without disabled)
    // Heuristic: `<button` and `onClick={` but no `disabled={` in the same tag, or using `async () =>`
    if (line.includes('<button') && line.includes('onClick') && !line.includes('disabled')) {
      // Extremely basic heuristic, will flag potential unprotected buttons
      doubleSubmissionRisks.push(i + 1);
    }

    // 4. Z-Index Hell (z-40, z-50, z-[9999])
    if (line.match(/z-\[?\d{2,}\]?/)) {
      // E.g., z-50, z-[99]
      if (!line.includes('z-10') && !line.includes('z-20')) {
        zIndexHell.push(i + 1);
      }
    }

    // 5. useEffect Race Conditions (Very naive static check)
    if (line.match(/useEffect\(\s*\(\)\s*=>/)) {
      inUseEffect = true;
      useEffectBrackets = 1;
      hasMountedCheck = false;
      hasAsyncInEffect = false;
    }
    
    if (inUseEffect) {
      if (line.includes('{')) useEffectBrackets++;
      if (line.includes('}')) useEffectBrackets--;
      
      if (line.includes('isMounted') || line.includes('mounted') || line.includes('AbortController')) {
        hasMountedCheck = true;
      }
      if (line.includes('await supabase')) {
        hasAsyncInEffect = true;
      }

      if (useEffectBrackets <= 0) {
        if (hasAsyncInEffect && !hasMountedCheck) {
          unmountedSetStateRisks.push(i + 1); // Point to the end of the dangerous effect
        }
        inUseEffect = false;
      }
    }
  }

  if (keyIndexRisks.length > 0 || tsIgnoreRisks.length > 0 || doubleSubmissionRisks.length > 0 || zIndexHell.length > 0 || unmountedSetStateRisks.length > 0) {
    let fileReport = `### \`${filePath.replace(/\\/g, '/')}\`\n`;
    let hasIssues = false;

    if (keyIndexRisks.length > 0) {
      fileReport += `- **Anti-pattern React (\`key={index}\` corrompe renderização de listas mutáveis):** Lines ${keyIndexRisks.slice(0,5).join(', ')}${keyIndexRisks.length>5?'...':''}\n`;
      hasIssues = true;
    }
    if (tsIgnoreRisks.length > 0) {
      fileReport += `- **Supressão de Segurança (Uso de \`@ts-ignore\` ou \`eslint-disable\`):** Lines ${tsIgnoreRisks.join(', ')}\n`;
      hasIssues = true;
    }
    if (doubleSubmissionRisks.length > 0) {
      fileReport += `- **Risco de Submissão Dupla (Botões sem bloqueio de estado \`disabled\` no \`onClick\`):** Lines ${doubleSubmissionRisks.slice(0,5).join(', ')}${doubleSubmissionRisks.length>5?'...':''}\n`;
      hasIssues = true;
    }
    if (zIndexHell.length > 0) {
      fileReport += `- **Débito de Z-Index (Z-index elevados e hardcoded causam conflitos de modais):** Lines ${zIndexHell.slice(0,5).join(', ')}${zIndexHell.length>5?'...':''}\n`;
      hasIssues = true;
    }
    if (unmountedSetStateRisks.length > 0) {
      fileReport += `- **Race Condition em Data Fetching (Efeito Assíncrono sem flag \`isMounted\` nem limpeza):** Lines ${unmountedSetStateRisks.join(', ')}\n`;
      hasIssues = true;
    }

    if (hasIssues) {
      report += fileReport + '\n';
    }
  }
}

scanDirectory(rootDir);

fs.writeFileSync('audit_deep_part4.md', report);
console.log('Auditoria profunda fase 4 concluída.');
