const fs = require('fs');
const path = require('path');

const mojibakePatterns = [
  'ÃÂ', 'Ã§', 'Ã£', 'Ã©', 'Ã¡', 'Ã³', 'Ãº', 'Ãª', 'Ãµ', 'Ã¢', 'Ã\x8D', 'Ã\x93', 'Ã\x9A', 'Ã\x87', 'Ã\x83', 'Ã\x89', 'Ã\x81',
  'â€', 'â”', 'âœ', 'âš', 'â„', 'â€¦', 'Ã—', 'Ã¼', 'Ã\xAD', 'Ã°', 'Ãƒ', 'ï¿½', '\uFFFD', '\u0000'
];

const fileMap = {};

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.agents') continue;
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (/\.(ts|tsx|js|jsx|json|sql|cjs|mjs|html|md|css)$/i.test(entry.name)) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        for (const pattern of mojibakePatterns) {
          if (line.includes(pattern)) {
            const rel = path.relative('.', fullPath);
            if (!fileMap[rel]) fileMap[rel] = [];
            fileMap[rel].push({ line: idx + 1, pattern, text: line.trim() });
            break;
          }
        }
      });
    }
  }
}

scanDir(path.resolve('.'));
fs.writeFileSync(
  path.join(__dirname, 'mojibake_findings.json'),
  JSON.stringify(fileMap, null, 2),
  'utf8'
);

console.log(`Found ${Object.keys(fileMap).length} files with potential mojibake/corrupted encoding.`);
for (const [file, items] of Object.entries(fileMap)) {
  console.log(`- ${file} (${items.length} lines)`);
}
