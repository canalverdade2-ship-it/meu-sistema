const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\Adriano Farias\\Downloads\\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\\src\\routing\\adminAccess.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Update canAccessAdminModule to block gsa-tv for colaborador
content = content.replace(
  /  if \(normalized === 'dashboard'\) return true;\r?\n  if \(normalized === 'acessos'\) return false;/s,
  `  if (normalized === 'dashboard') return true;\n  if (normalized === 'acessos') return false;\n  if (normalized === 'gsa-tv') return false;`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('File updated successfully.');
