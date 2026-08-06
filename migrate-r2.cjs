const fs = require('fs');
const path = require('path');

const projectRoot = 'c:\\Users\\Adriano Farias\\Downloads\\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)';

const replaceInFile = (relPath, replacements) => {
  const fullPath = path.join(projectRoot, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log('Not found:', relPath);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let originalContent = content;
  
  for (const { search, replace, isRegex = false } of replacements) {
    if (isRegex) {
      content = content.replace(search, replace);
    } else {
      content = content.split(search).join(replace);
    }
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content);
    console.log('Updated:', relPath);
  } else {
    console.log('No changes needed:', relPath);
  }
};

const importStatement = `import { uploadToR2, getR2PublicUrl, removeFromR2, getPrivateR2Url } from '../../lib/r2Storage';\n`;

// NOTE: Since paths to lib differ, we might need a dynamic import inserter.
function addImport(fileContent, relativeDepth) {
  if (fileContent.includes('r2Storage')) return fileContent;
  const libPath = relativeDepth === 1 ? '../lib/r2Storage' :
                  relativeDepth === 2 ? '../../lib/r2Storage' :
                  relativeDepth === 3 ? '../../../lib/r2Storage' :
                  '../../lib/r2Storage';
  const r2Import = `import { uploadToR2, getR2PublicUrl, removeFromR2, getPrivateR2Url } from '${libPath}';\n`;
  
  // insert after supabase import or at top
  if (fileContent.includes('import { supabase }')) {
    return fileContent.replace(/(import .*? from '.*?supabase.*?';\n)/, `$1${r2Import}`);
  }
  return r2Import + fileContent;
}

const updateFile = (relPath, relativeDepth, customReplacements = []) => {
  const fullPath = path.join(projectRoot, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log('Not found:', relPath);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let originalContent = content;
  
  content = addImport(content, relativeDepth);
  
  for (const { search, replace } of customReplacements) {
    content = content.replace(search, replace);
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content);
    console.log('Updated:', relPath);
  }
};

// We will do a generic replacement script for React components.
const filesToProcess = [
  { path: 'src/components/admin/ServicosModule.tsx', depth: 2 },
  { path: 'src/components/admin/SiteCampaignAdminModule.tsx', depth: 2 },
  { path: 'src/components/admin/CreditoModule.tsx', depth: 2 },
  { path: 'src/components/admin/EmprestimosModule.tsx', depth: 2 },
  { path: 'src/components/admin/ReembolsosModule.tsx', depth: 2 },
  { path: 'src/components/admin/CareersAdminModule.tsx', depth: 2 },
  { path: 'src/components/admin/clientes/AdminClienteDocumentos.tsx', depth: 3 },
  { path: 'src/components/admin/demandas/DemandasComentarios.tsx', depth: 3 },
  { path: 'src/components/admin/demandas/DemandasDetalhesModal.tsx', depth: 3 },
  { path: 'src/components/admin/demandas/NovaDemandaModal.tsx', depth: 3 },
  { path: 'src/components/admin/prestadores/AdminPrestadorDocumentos.tsx', depth: 3 },
  { path: 'src/components/admin/prestadores/PrestadoresDemandas.tsx', depth: 3 },
  { path: 'src/components/client/ClientEmprestimos.tsx', depth: 2 },
  { path: 'src/components/client/ClientMeuCredito.tsx', depth: 2 },
  { path: 'src/components/admin/TravelAdminModule.tsx', depth: 2 },
  { path: 'src/components/admin/ClientesModule.tsx', depth: 2 }
];

for (const f of filesToProcess) {
  const fullPath = path.join(projectRoot, f.path);
  if (!fs.existsSync(fullPath)) continue;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  content = addImport(content, f.depth);
  
  // Generic replaces for React components:
  // Upload:
  // const { error: uploadError } = await supabase.storage.from('bucket-name').upload(filePath, file);
  // const { data: { publicUrl } } = supabase.storage.from('bucket-name').getPublicUrl(filePath);
  
  content = content.replace(/const\s+\{\s*error\s*:\s*([^}]+)\s*\}\s*=\s*await\s+supabase\.storage\s*\.from\('([^']+)'\)\s*\.upload\(([^,]+),\s*([^,\)]+)(?:,\s*\{[^}]+\})?\);/g, 
    'const { error: $1, url: __publicUrl, path: __r2Path } = await uploadToR2($4, \'$2\', $3);');
    
  content = content.replace(/const\s+\{\s*data\s*,\s*error(?:[^}]+)\s*\}\s*=\s*await\s+supabase\.storage\s*\.from\('([^']+)'\)\s*\.upload\(([^,]+),\s*([^,\)]+)(?:,\s*\{[^}]+\})?\);/g, 
    'const { url: publicUrl, error, path: r2Path } = await uploadToR2($3, \'$1\', $2);');

  content = content.replace(/const\s+\{\s*data\s*:\s*\{\s*publicUrl\s*(?::\s*([^}]+))?\s*\}\s*\}\s*=\s*supabase\.storage\s*\.from\('([^']+)'\)\s*\.getPublicUrl\(([^)]+)\);/g, 
    '// publicUrl is handled by uploadToR2 directly if bucket is public, else use getR2PublicUrl or getPrivateR2Url.');

  content = content.replace(/const\s+\{\s*error(?:[^}]+)\s*\}\s*=\s*await\s+supabase\.storage\s*\.from\('([^']+)'\)\s*\.upload\(([^,]+),\s*([^,\)]+)(?:,\s*\{[^}]+\})?\);/g, 
    'const { error, url: publicUrl, path: r2Path } = await uploadToR2($3, \'$1\', $2);');

  content = content.replace(/await\s+supabase\.storage\s*\.from\('([^']+)'\)\s*\.remove\(\[([^\]]+)\]\);/g, 
    'await removeFromR2($2);');
    
  fs.writeFileSync(fullPath, content);
  console.log('Processed component:', f.path);
}

// Now handle the lib files explicitly:
const libUploadHelper = path.join(projectRoot, 'src/lib/uploadHelper.ts');
if (fs.existsSync(libUploadHelper)) {
  let content = fs.readFileSync(libUploadHelper, 'utf8');
  content = `import { uploadToR2 } from './r2Storage';\n` + content;
  content = content.replace(/import\s+\{\s*supabase\s*\}\s+from\s+'[^']+';/, '');
  content = content.replace(/const\s+\{\s*data\s*,\s*error\s*\}\s*=\s*await\s+supabase\.storage\s*\.from\(bucket\)\s*\.upload\(filePath,\s*file\);/, 
    'const { url, path: r2Path, error } = await uploadToR2(file, bucket, filePath);\n    const data = { path: r2Path };');
  content = content.replace(/const\s+\{\s*data\s*:\s*publicUrlData\s*\}\s*=\s*supabase\.storage\s*\.from\(bucket\)\s*\.getPublicUrl\(filePath\);/,
    '// url handled');
  fs.writeFileSync(libUploadHelper, content);
  console.log('Processed src/lib/uploadHelper.ts');
}

console.log('Done script.');
