const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    if (dirPath.includes('node_modules') || dirPath.includes('.git')) return;
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(dirPath);
  });
}

// matches catch (e) { } or catch (error: any) { } or catch (err: unknown) { } etc as long as it's empty
const emptyCatchRegex1 = /catch\s*\(\s*([a-zA-Z0-9_]+)(?:\s*:\s*[a-zA-Z0-9_]+)?\s*\)\s*\{\s*\}/g;

let count = 0;

walk('./src', (filePath) => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let changed = false;

    if (emptyCatchRegex1.test(content)) {
      content = content.replace(emptyCatchRegex1, (match, errName) => {
        return `catch (${errName}) { console.error("Erro capturado:", ${errName}); }`;
      });
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf-8');
      count++;
      console.log(`Updated ${filePath}`);
    }
  }
});
console.log(`Updated ${count} files.`);
