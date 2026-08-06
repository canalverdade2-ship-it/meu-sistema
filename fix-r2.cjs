const fs = require('fs');
const path = require('path');

const projectRoot = 'c:\\Users\\Adriano Farias\\Downloads\\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)';

const filesToProcess = [
  'src/components/admin/SiteCampaignAdminModule.tsx',
  'src/components/admin/ReembolsosModule.tsx',
  'src/components/admin/CareersAdminModule.tsx',
  'src/components/admin/clientes/AdminClienteDocumentos.tsx',
  'src/components/admin/prestadores/AdminPrestadorDocumentos.tsx',
  'src/components/admin/TravelAdminModule.tsx',
  'src/components/admin/ClientesModule.tsx',
  'src/lib/uploadHelper.ts'
];

for (const relPath of filesToProcess) {
  const fullPath = path.join(projectRoot, relPath);
  if (!fs.existsSync(fullPath)) continue;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Replace anything that looks like:
  // const { ... } = await supabase.storage.from(...).upload(...)
  content = content.replace(
    /const\s+\{\s*(?:[^}]*?)error(?:[^}]*?)\}\s*=\s*await\s+supabase\.storage[\s\S]*?\.from\((['"`])([^'"`]+)\1\)[\s\S]*?\.upload\(([^,]+),\s*([^,\)]+)[^\)]*\);/g,
    'const { error, url: publicUrl, path: r2Path } = await uploadToR2($4, \'$2\', $3);'
  );

  content = content.replace(
    /const\s+\{\s*(?:[^}]*?)data\s*:\s*([^,}\s]+)(?:[^}]*?)\}\s*=\s*supabase\.storage[\s\S]*?\.from\((['"`])([^'"`]+)\2\)[\s\S]*?\.getPublicUrl\(([^)]+)\);/g,
    '// publicUrl is handled directly'
  );

  content = content.replace(
    /const\s+url\s*=\s*supabase\.storage\.from\((['"`])([^'"`]+)\1\)\.getPublicUrl\(([^)]+)\)\.data\.publicUrl;/g,
    '// url handled directly'
  );

  content = content.replace(
    /await\s+supabase\.storage[\s\S]*?\.from\((['"`])([^'"`]+)\1\)[\s\S]*?\.remove\(\[([^\]]+)\]\);/g,
    'await removeFromR2($3);'
  );

  fs.writeFileSync(fullPath, content);
  console.log('Fixed', relPath);
}

// Special cases
const uploadHelperPath = path.join(projectRoot, 'src/lib/uploadHelper.ts');
if (fs.existsSync(uploadHelperPath)) {
  let content = fs.readFileSync(uploadHelperPath, 'utf8');
  content = content.replace(
    /const\s+\{\s*error:\s*uploadError\s*\}\s*=\s*await\s+supabase\.storage[\s\S]*?\.from\(bucket\)[\s\S]*?\.upload\(filePath,\s*file\);/,
    'const { url, path: r2Path, error: uploadError } = await uploadToR2(file, bucket, filePath);\n    const data = { path: r2Path };'
  );
  content = content.replace(
    /const\s+\{\s*data:\s*\{\s*publicUrl\s*\}\s*\}\s*=\s*supabase\.storage[\s\S]*?\.from\(bucket\)[\s\S]*?\.getPublicUrl\(filePath\);/,
    '// public url already set'
  );
  fs.writeFileSync(uploadHelperPath, content);
}
