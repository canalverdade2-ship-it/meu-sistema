const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(dirPath);
  });
}

const emptyCatchRegex = /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g;

walk('./src', (filePath) => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    const content = fs.readFileSync(filePath, 'utf-8');
    let match;
    while ((match = emptyCatchRegex.exec(content)) !== null) {
      // Find line number
      const lineNum = content.substring(0, match.index).split('\n').length;
      console.log(`${filePath}:${lineNum}`);
    }
  }
});
