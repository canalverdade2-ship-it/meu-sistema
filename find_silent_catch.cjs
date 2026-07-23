const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(dirPath);
  });
}

const catchRegex = /catch\s*(?:\([^)]*\))?\s*\{([\s\S]*?)\}/g;

walk('./src', (filePath) => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    const content = fs.readFileSync(filePath, 'utf-8');
    let match;
    while ((match = catchRegex.exec(content)) !== null) {
      const catchBody = match[1];
      // Check if it's "silent" - doesn't log the error
      if (!catchBody.includes('console.error') && 
          !catchBody.includes('console.log') &&
          !catchBody.includes('toast.error') &&
          !catchBody.includes('logError') &&
          !catchBody.includes('Sentry.captureException')) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        console.log(`${filePath}:${lineNum} - Silent catch block`);
      }
    }
  }
});
