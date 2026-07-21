import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scanRoots = ['src', 'supabase/functions'];
const supportedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.html']);
const ignoredSegments = [
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}dist${path.sep}`,
  `${path.sep}build${path.sep}`,
  `${path.sep}coverage${path.sep}`,
  `${path.sep}__tests__${path.sep}`,
  `${path.sep}validation${path.sep}`,
];

const explicitBlockers = [
  { id: 'mocked-demo', regex: /mocked\s+para\s+demonstra[cç][aã]o/i, description: 'Fluxo marcado como mock de demonstração' },
  { id: 'demo-only', regex: /(?:apenas|somente)\s+(?:para\s+)?demonstra[cç][aã]o/i, description: 'Funcionalidade declarada somente para demonstração' },
  { id: 'test-only', regex: /(?:apenas|somente)\s+(?:para\s+)?test(?:e|ar)/i, description: 'Funcionalidade declarada somente para teste' },
  { id: 'fake-data', regex: /(?:dados?|data)\s+(?:fict[ií]ci[oa]s?|fals[oa]s?|fake|mock)/i, description: 'Dados fictícios ou simulados no código de operação' },
  { id: 'not-implemented', regex: /n[aã]o\s+implementad[oa]|not\s+implemented/i, description: 'Funcionalidade declarada como não implementada' },
  { id: 'coming-soon', regex: /\bem\s+breve\b|coming\s+soon/i, description: 'Funcionalidade apresentada como futura' },
  { id: 'simulated-upload', regex: /simular\s+upload|upload\s+simulad[oa]/i, description: 'Upload simulado em vez de armazenamento real' },
  { id: 'paste-test-url', regex: /cole\s+a\s+url.+(?:testar|demonstra)/i, description: 'Colagem manual de URL usada como substituto de upload real' },
];

const suspiciousPatterns = [
  { id: 'runtime-prompt', regex: /\b(?:window\.)?prompt\s*\(/, description: 'Uso de prompt no fluxo operacional; revisar se substitui formulário ou integração real' },
  { id: 'empty-click', regex: /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/, description: 'Botão com manipulador vazio' },
  { id: 'hash-link', regex: /href\s*=\s*["']#["']/, description: 'Link sem destino operacional' },
  { id: 'mock-reference', regex: /\bmock(?:ed|up)?\b/i, description: 'Referência a mock em código executável' },
  { id: 'fake-reference', regex: /\bfake\b|\bdummy\b/i, description: 'Referência a dado ou fluxo artificial em código executável' },
  { id: 'demo-reference', regex: /\bdemo\b|demonstra[cç][aã]o/i, description: 'Referência a demonstração em código executável' },
];

function shouldIgnore(filePath) {
  const normalized = path.normalize(filePath);
  if (ignoredSegments.some(segment => normalized.includes(segment))) return true;
  const base = path.basename(normalized).toLowerCase();
  return base.includes('.test.') || base.includes('.spec.') || base.endsWith('.d.ts');
}

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!shouldIgnore(`${fullPath}${path.sep}`)) walk(fullPath, files);
      continue;
    }
    if (shouldIgnore(fullPath)) continue;
    if (supportedExtensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }
  return files;
}

function inspectLine(file, line, lineNumber, pattern, severity) {
  pattern.regex.lastIndex = 0;
  if (!pattern.regex.test(line)) return null;
  return {
    severity,
    rule: pattern.id,
    description: pattern.description,
    file: path.relative(root, file).replaceAll(path.sep, '/'),
    line: lineNumber,
    excerpt: line.trim().slice(0, 300),
  };
}

const findings = [];
const scannedFiles = scanRoots.flatMap(scanRoot => walk(path.join(root, scanRoot)));

for (const file of scannedFiles) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of explicitBlockers) {
      const finding = inspectLine(file, line, index + 1, pattern, 'blocker');
      if (finding) findings.push(finding);
    }
    for (const pattern of suspiciousPatterns) {
      const finding = inspectLine(file, line, index + 1, pattern, 'review');
      if (finding && !findings.some(item => item.file === finding.file && item.line === finding.line && item.rule === finding.rule)) {
        findings.push(finding);
      }
    }
  });
}

const uniqueFindings = Array.from(new Map(findings.map(item => [`${item.severity}:${item.rule}:${item.file}:${item.line}`, item])).values());
const blockers = uniqueFindings.filter(item => item.severity === 'blocker');
const review = uniqueFindings.filter(item => item.severity === 'review');
const generatedAt = new Date().toISOString();
const reportDir = path.join(root, 'audit');
fs.mkdirSync(reportDir, { recursive: true });

const report = {
  generated_at: generatedAt,
  scope: scanRoots,
  scanned_files: scannedFiles.length,
  blocker_count: blockers.length,
  review_count: review.length,
  blockers,
  review,
};

fs.writeFileSync(path.join(reportDir, 'production-real-audit.json'), `${JSON.stringify(report, null, 2)}\n`);

const markdown = [
  '# Auditoria de operação real',
  '',
  `Gerada em: ${generatedAt}`,
  '',
  `Arquivos executáveis examinados: **${scannedFiles.length}**`,
  '',
  `Bloqueadores explícitos: **${blockers.length}**`,
  '',
  `Ocorrências para revisão humana: **${review.length}**`,
  '',
  '## Bloqueadores',
  '',
  ...(blockers.length ? blockers.map(item => `- \`${item.file}:${item.line}\` — ${item.description} — \`${item.excerpt.replaceAll('`', '\\`')}\``) : ['Nenhum bloqueador explícito encontrado.']),
  '',
  '## Revisão humana',
  '',
  ...(review.length ? review.map(item => `- \`${item.file}:${item.line}\` — ${item.description} — \`${item.excerpt.replaceAll('`', '\\`')}\``) : ['Nenhuma ocorrência adicional encontrada.']),
  '',
].join('\n');

fs.writeFileSync(path.join(reportDir, 'production-real-audit.md'), markdown);

console.log(`Auditoria concluída: ${scannedFiles.length} arquivos, ${blockers.length} bloqueador(es), ${review.length} ocorrência(s) para revisão.`);
if (blockers.length > 0) {
  console.error('\nBloqueadores encontrados pela auditoria de operação real:');
  for (const item of blockers) {
    console.error(`- ${item.file}:${item.line} [${item.rule}] ${item.excerpt}`);
  }
  console.error('\nRelatório completo: audit/production-real-audit.md');
}
if (process.argv.includes('--enforce') && blockers.length > 0) process.exit(1);
