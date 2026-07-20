const fs = require('fs');
const path = require('path');

// Nome da pasta atual e caminho
const currentDir = __dirname;
const parentDir = path.dirname(currentDir);
const currentDirName = path.basename(currentDir);

// Pastas a serem ignoradas no backup (para o backup ser instantâneo e leve)
const IGNORED_FOLDERS = [
  'node_modules',
  'dist',
  '.git',
  '.agents',
  'test-results',
  'playwright-report',
  '.codex-remote-attachments'
];

function getNextBackupName() {
  try {
    const files = fs.readdirSync(parentDir);
    let maxNum = 0;
    
    // Expressão regular para achar "Copia (N)"
    const regex = /remix-9.10_-grupo-gsa---gestão-de-serviços - Copia \((\d+)\)/i;
    
    files.forEach(file => {
      const match = file.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    });
    
    const nextNum = maxNum + 1;
    return `remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (${nextNum})`;
  } catch (err) {
    // Fallback com timestamp caso dê erro ao listar diretório
    const now = new Date();
    const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    return `remix-9.10_-grupo-gsa---gestão-de-serviços - Backup_${timestamp}`;
  }
}

// Copia recursiva ignorando pastas pesadas
function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  
  const entries = fs.readdirSync(from, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    
    if (entry.isDirectory()) {
      if (IGNORED_FOLDERS.includes(entry.name)) {
        continue; // Pula pastas ignoradas
      }
      copyFolderSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function runBackup() {
  const nextBackupName = getNextBackupName();
  const destDir = path.join(parentDir, nextBackupName);
  
  console.log(`\x1b[36mIniciando backup de:\x1b[0m ${currentDirName}`);
  console.log(`\x1b[36mPara:\x1b[0m ${nextBackupName}`);
  console.log(`\x1b[33m(Ignorando pastas pesadas como node_modules, dist e .git para ir mais rápido...)\x1b[0m`);
  
  const startTime = Date.now();
  
  try {
    copyFolderSync(currentDir, destDir);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n\x1b[32m✔ Backup concluído com sucesso em ${duration} segundos!\x1b[0m`);
    console.log(`\x1b[35mCaminho do backup:\x1b[0m ${destDir}`);
  } catch (error) {
    console.error(`\x1b[31m✖ Erro ao realizar o backup:\x1b[0m`, error);
  }
}

runBackup();
