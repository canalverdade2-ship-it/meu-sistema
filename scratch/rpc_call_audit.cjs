const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'src');
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(filePath);
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      files.push(filePath);
    }
  }
}

walk(root);

const calls = new Map();
const patterns = [
  /\.rpc\(\s*['"]([^'"]+)['"]/g,
  /\bcallClientRpc(?:<[^>]+>)?\(\s*['"]([^'"]+)['"]/g,
];

for (const filePath of files) {
  const source = fs.readFileSync(filePath, 'utf8');
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const relativePath = path.relative(path.resolve(__dirname, '..'), filePath).replaceAll('\\', '/');
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      const current = calls.get(match[1]) || { count: 0, usages: [] };
      current.count += 1;
      current.usages.push({ file: relativePath, line });
      calls.set(match[1], current);
    }
  }
}

const result = {
  generatedAt: new Date().toISOString(),
  filesScanned: files.length,
  rpcCount: calls.size,
  calls: Object.fromEntries([...calls.entries()].sort(([left], [right]) => left.localeCompare(right))),
};

const outputPath = path.join(__dirname, 'rpc_call_audit.json');
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

console.log(`Arquivos: ${result.filesScanned}`);
console.log(`RPCs distintos: ${result.rpcCount}`);
for (const [name, details] of Object.entries(result.calls)) {
  const locations = [...new Set(details.usages.map((usage) => usage.file))].join(', ');
  console.log(`${name}\t${details.count}\t${locations}`);
}
