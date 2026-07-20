import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, 'src');

function findUtilsRelativePath(filePath) {
  const utilsPath = path.join(srcDir, 'lib', 'utils.ts');
  let relPath = path.relative(path.dirname(filePath), utilsPath);
  relPath = relPath.replace(/\\/g, '/');
  if (relPath.endsWith('.ts')) {
    relPath = relPath.slice(0, -3); // remove .ts
  }
  if (!relPath.startsWith('.')) {
    relPath = './' + relPath;
  }
  return relPath;
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      if (fullPath.endsWith('utils.ts')) continue; // Skip utils.ts

      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('crypto.randomUUID()')) {
        console.log(`Fixing ${fullPath}`);
        
        // 1. Replace crypto.randomUUID() with generateUUID()
        content = content.replace(/crypto\.randomUUID\(\)/g, 'generateUUID()');

        // 2. Ensure generateUUID is imported
        if (!content.includes('generateUUID')) {
          // This case shouldn't happen because we just replaced it, but we check if it was already imported
        }
        
        // Check if there is an import from utils
        const utilsRelPath = findUtilsRelativePath(fullPath);
        // regex to find import from utils (e.g. import { formatCurrency } from '../../lib/utils'; or './utils')
        const importRegex = new RegExp(`import\\s+\\{([^}]+)\\}\\s+from\\s+['"]([^'"]*utils)['"];?`, 'g');
        let utilsImportFound = false;
        
        content = content.replace(importRegex, (match, importsStr, modulePath) => {
          utilsImportFound = true;
          if (!importsStr.includes('generateUUID')) {
            const newImportsStr = importsStr.trim() + (importsStr.trim().endsWith(',') ? '' : ', ') + 'generateUUID';
            return `import { ${newImportsStr} } from '${modulePath}';`;
          }
          return match;
        });

        if (!utilsImportFound) {
          // Add new import at the top after React imports
          const importStatement = `import { generateUUID } from '${utilsRelPath}';\n`;
          
          // find last import to append after, or just put at top
          content = importStatement + content;
        }

        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  }
}

processDirectory(srcDir);
console.log("Done");
