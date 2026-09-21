const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.agents' && file !== 'dist') {
        results = results.concat(walk(filePath));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk('src');

console.log('=== DEEP DIVE: ALL setInterval INSTANCES ===');

const intervals = [];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    if (line.includes('setInterval(') || line.includes('setInterval (')) {
      const windowText = lines.slice(Math.max(0, idx - 2), Math.min(lines.length, idx + 20)).join('\n');
      intervals.push({
        file: f,
        line: idx + 1,
        snippet: windowText
      });
    }
  });
});

console.log(`Total intervals found: ${intervals.length}`);
intervals.forEach((it, i) => {
  console.log(`\n[${i + 1}] ${it.file}:${it.line}`);
  console.log(it.snippet);
});
