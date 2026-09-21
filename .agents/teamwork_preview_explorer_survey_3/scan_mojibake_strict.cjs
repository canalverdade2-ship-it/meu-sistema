const fs = require('fs');
const path = require('path');

const mojibakePatterns = [
  'ÃÂ', 'Ã§', 'Ã£', 'Ã©', 'Ã¡', 'Ã³', 'Ãº', 'Ãª', 'Ãµ', 'Ã¢', 'Ã\x8D', 'Ã\x93', 'Ã\x9A', 'Ã\x87', 'Ã\x83', 'Ã\x89', 'Ã\x81',
  'â€', 'â”', 'âœ', 'âš', 'â„', 'â€¦', 'Ã—', 'Ã¼', 'Ã\xAD', 'Ã°', 'Ãƒ', 'ï¿½', '\uFFFD', '\u0000'
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
      // ignore test files that are testing FOR mojibake
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) {
        continue;
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        for (const pattern of mojibakePatterns) {
          if (line.includes(pattern)) {
            // Check if it's not a regex or comment testing for mojibake
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

console.log(`=== TOTAL FILES WITH CORRUPTED CHARS (EXCLUDING TESTS): ${results.length} ===`);
results.forEach(r => {
  console.log(`${r.file}:${r.line} [${JSON.stringify(r.pattern)}] => ${r.preview}`);
});
