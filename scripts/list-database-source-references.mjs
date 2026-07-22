import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outputDirectory = path.join(root, 'audit');
const validIdentifier = /^[a-z_][a-z0-9_]*$/i;

function walk(directory, output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', 'coverage', 'test-results', 'playwright-report'].includes(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolutePath, output);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) output.push(absolutePath);
  }
  return output;
}

function lineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

function addReference(target, value, filePath, line) {
  const normalized = String(value || '').trim();
  if (!validIdentifier.test(normalized)) return false;
  const references = target.get(normalized) || [];
  references.push({ file: filePath, line });
  target.set(normalized, references);
  return true;
}

function serialize(map) {
  return Object.fromEntries(
    [...map.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, references]) => [
        name,
        references.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line),
      ]),
  );
}

const tables = new Map();
const rpcs = new Map();
const buckets = new Map();
const rejected = [];
const sourceFiles = [
  ...walk(path.join(root, 'src')),
  ...walk(path.join(root, 'supabase', 'functions')),
];

for (const absolutePath of sourceFiles) {
  const content = fs.readFileSync(absolutePath, 'utf8');
  const filePath = path.relative(root, absolutePath).replaceAll('\\', '/');

  for (const match of content.matchAll(/\.storage\s*\.from\(\s*['"]([^'"]+)['"]/g)) {
    if (!addReference(buckets, match[1], filePath, lineNumber(content, match.index))) {
      rejected.push({ kind: 'bucket', value: match[1], file: filePath, line: lineNumber(content, match.index) });
    }
  }

  for (const match of content.matchAll(/\.from\(\s*['"]([^'"]+)['"]/g)) {
    const prefix = content.slice(Math.max(0, match.index - 80), match.index);
    if (/\.storage\s*$/.test(prefix) || /\.schema\(\s*['"]storage['"]\s*\)\s*$/.test(prefix)) continue;
    if (!addReference(tables, match[1], filePath, lineNumber(content, match.index))) {
      rejected.push({ kind: 'table', value: match[1], file: filePath, line: lineNumber(content, match.index) });
    }
  }

  const rpcPatterns = [
    /\.rpc(?:<[^>]+>)?\(\s*['"]([^'"]+)['"]/g,
    /call(?:Admin|Client)Rpc(?:<[^>]+>)?\(\s*['"]([^'"]+)['"]/g,
  ];
  for (const pattern of rpcPatterns) {
    for (const match of content.matchAll(pattern)) {
      if (!addReference(rpcs, match[1], filePath, lineNumber(content, match.index))) {
        rejected.push({ kind: 'rpc', value: match[1], file: filePath, line: lineNumber(content, match.index) });
      }
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  counts: {
    files: sourceFiles.length,
    tables: tables.size,
    rpcs: rpcs.size,
    buckets: buckets.size,
    rejected: rejected.length,
  },
  tables: serialize(tables),
  rpcs: serialize(rpcs),
  buckets: serialize(buckets),
  rejected: rejected.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line),
};

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(
  path.join(outputDirectory, 'database-source-references.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);

console.log(JSON.stringify(report, null, 2));
console.log('DATABASE_SOURCE_REFERENCES_OK');
