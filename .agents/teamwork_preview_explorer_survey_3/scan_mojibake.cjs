const fs = require('fs');
const path = require('path');

const mojibakePatterns = [
  'ÃÂ', 'Ã§', 'Ã£', 'Ã©', 'Ã¡', 'Ã³', 'Ãº', 'Ãª', 'Ãµ', 'Ã¢', 'Ã\x8D', 'Ã\x93', 'Ã\x9A', 'Ã\x87', 'Ã\x83', 'Ã\x89', 'Ã\x81',
  'â€', 'â”', 'âœ', 'âš', 'â„', 'â€¦', 'Â ', 'Â»', 'Â«', 'Ã—', 'Ã¼', 'Ã\xAD', 'ï¿½', '\uFFFD'
];

const results = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.agents') continue;
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (/\.(ts|tsx|js|jsx|json|sql|cjs|mjs|html|md|css)$/i.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        for (const pattern of mojibakePatterns) {
          if (line.includes(pattern)) {
            results.push({
              file: fullPath,
              line: idx + 1,
              pattern: pattern,
              preview: line.trim()
            });
            break;
          }
        }
      });
    }
  }
}

scanDir(path.resolve('.'));

console.log(`Found ${results.length} occurrences.`);
results.forEach(r => {
  console.log(`${r.file}:${r.line} [${r.pattern}] => ${r.preview.slice(0, 140)}`);
});
