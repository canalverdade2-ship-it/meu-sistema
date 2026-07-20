const fs = require('fs');
const path = require('path');

const root = process.cwd();
const reportPath = path.join(root, 'scratch', 'character_audit_report.md');
const exts = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs',
  '.sql', '.json', '.md', '.txt', '.html', '.css',
  '.env', '.example', '.yml', '.yaml'
]);
const ignoredDirs = new Set([
  'node_modules',
  '.git',
  'dist',
  '.codex-remote-attachments',
  '.agents',
  'scratch',
]);
const ignoredFiles = new Set([
  'package-lock.json',
  'schema_dump.json',
  'parsed_store_code.txt',
  'temp_file_view.txt'
]);

const scanners = [
  {
    name: 'replacement-character',
    severity: 'critical',
    re: /\uFFFD/g,
    description: 'Caractere de substituicao Unicode; geralmente indica byte invalido ou perda de encoding.'
  },
  {
    name: 'c1-control',
    severity: 'critical',
    re: /[\u0080-\u009F]/g,
    description: 'Controle C1 invisivel; geralmente aparece em mojibake.'
  },
  {
    name: 'utf8-mojibake-c3',
    severity: 'high',
    re: /\u00C3[\u0080-\u00BF]/g,
    description: 'Detects common UTF-8 double-decoding patterns in accented text.'
  },
  {
    name: 'utf8-mojibake-c2',
    severity: 'high',
    re: /\u00C2[\u0080-\u00BF]/g,
    description: 'Detects common UTF-8 double-decoding patterns in accented text.'
  },
  {
    name: 'utf8-mojibake-e2',
    severity: 'high',
    re: /\u00E2[\u0080-\u00BF]/g,
    description: 'Detects common UTF-8 double-decoding patterns in punctuation and symbols.'
  },
  {
    name: 'utf8-mojibake-emoji',
    severity: 'high',
    re: /\u00F0(?:[\u0080-\u00BF]|\u0178)/g,
    description: 'Detects common UTF-8 double-decoding patterns in emoji.'
  },
  {
    name: 'visible-mojibake-literal',
    severity: 'high',
    re: /(?:\u00C3[^\sA-Z]|\u00C2[^\sA-Z]|\u00E2[\u0080-\u00BF]|\u00F0(?:[\u0080-\u00BF]|\u0178)|\u00EF\u00BF\u00BD)/g,
    description: 'Padroes visiveis comuns de texto quebrado.'
  },
  {
    name: 'suspicious-question-in-portuguese',
    severity: 'medium',
    re: /\b(?:J\?|Voc\?|n\?o|c\?digo|conex\?o|inv\?lido|indica\?o|notifica\?o|solicita\?o|or\?amento|Cria\?o|gest\?o|a\?o|p\?blico|poss\?vel|est\?)\b/gi,
    description: 'Possivel perda de acento substituido por ponto de interrogacao.'
  },
  {
    name: 'zero-width-or-bom-inside-file',
    severity: 'medium',
    re: /[\u200B-\u200D\uFEFF]/g,
    description: 'Caracter invisivel que pode afetar busca, comparacao ou layout.'
  }
];

function shouldRead(file) {
  const base = path.basename(file);
  if (ignoredFiles.has(base)) return false;
  const ext = path.extname(file);
  if (exts.has(ext)) return true;
  if (base.startsWith('.env')) return true;
  return false;
}

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(root, full);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!ignoredDirs.has(name)) walk(full, files);
    } else if (stat.isFile() && shouldRead(full)) {
      files.push(rel);
    }
  }
  return files;
}

function lineAndColumn(text, index) {
  const before = text.slice(0, index);
  const lines = before.split(/\r?\n/);
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function snippet(line) {
  return line.replace(/\t/g, '\\t').slice(0, 220);
}

const files = walk(root).sort();
const findings = [];
let totalBytes = 0;

for (const rel of files) {
  const abs = path.join(root, rel);
  const buf = fs.readFileSync(abs);
  totalBytes += buf.length;
  const text = buf.toString('utf8');
  const lines = text.split(/\r?\n/);

  for (const scanner of scanners) {
    scanner.re.lastIndex = 0;
    let match;
    while ((match = scanner.re.exec(text))) {
      const pos = lineAndColumn(text, match.index);
      const lineText = lines[pos.line - 1] || '';
      findings.push({
        file: rel,
        line: pos.line,
        column: pos.column,
        severity: scanner.severity,
        type: scanner.name,
        match: match[0],
        snippet: snippet(lineText)
      });
    }
  }
}

const grouped = findings.reduce((acc, item) => {
  acc[item.severity] = (acc[item.severity] || 0) + 1;
  return acc;
}, {});
const byType = findings.reduce((acc, item) => {
  acc[item.type] = (acc[item.type] || 0) + 1;
  return acc;
}, {});

let report = '';
report += '# Character Encoding Audit\n\n';
report += `- Files scanned: ${files.length}\n`;
report += `- Bytes scanned: ${totalBytes}\n`;
report += `- Findings: ${findings.length}\n`;
report += `- Critical: ${grouped.critical || 0}\n`;
report += `- High: ${grouped.high || 0}\n`;
report += `- Medium: ${grouped.medium || 0}\n\n`;

report += '## Finding Types\n\n';
for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
  const scanner = scanners.find(s => s.name === type);
  report += `- ${type}: ${count} (${scanner?.description || ''})\n`;
}
report += '\n';

if (findings.length) {
  report += '## Findings\n\n';
  for (const f of findings) {
    report += `- [${f.severity}] ${f.type} ${f.file}:${f.line}:${f.column} match=${JSON.stringify(f.match)}\n`;
    report += `  \`${f.snippet.replace(/`/g, '\\`')}\`\n`;
  }
} else {
  report += '## Findings\n\nNo suspicious character patterns found.\n';
}

fs.writeFileSync(reportPath, report, 'utf8');

console.log(JSON.stringify({
  filesScanned: files.length,
  bytesScanned: totalBytes,
  findings: findings.length,
  bySeverity: grouped,
  byType,
  reportPath
}, null, 2));
