import fs from 'fs';
import path from 'path';

function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const files = scanDir('src');
const rpcs = {};
const tables = new Set();
const adminModules = scanDir('src/components/admin');

const rpcRegex = /(?:supabase\.rpc|callAdminRpc)\s*(?:<[^>]*>)?\s*\(\s*['"]([^'"]+)['"]/g;
const tableRegex = /supabase\s*\.\s*from\s*\(\s*['"]([^'"]+)['"]/g;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
  
  let match;
  while ((match = rpcRegex.exec(content)) !== null) {
    const rpcName = match[1];
    if (!rpcs[rpcName]) rpcs[rpcName] = [];
    if (!rpcs[rpcName].includes(relPath)) rpcs[rpcName].push(relPath);
  }
  while ((match = tableRegex.exec(content)) !== null) {
    tables.add(match[1]);
  }
}

// Map admin module to RPCs and tables
const moduleAnalysis = {};
for (const file of adminModules) {
  const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  
  const fileRpcs = [];
  let match;
  while ((match = rpcRegex.exec(content)) !== null) {
    if (!fileRpcs.includes(match[1])) fileRpcs.push(match[1]);
  }
  
  const fileTables = [];
  while ((match = tableRegex.exec(content)) !== null) {
    if (!fileTables.includes(match[1])) fileTables.push(match[1]);
  }

  moduleAnalysis[relPath] = {
    rpcs: fileRpcs,
    tables: fileTables,
    size: content.length,
    lines: content.split('\n').length
  };
}

const output = {
  totalRpcs: Object.keys(rpcs).length,
  rpcs,
  totalTables: tables.size,
  tables: Array.from(tables).sort(),
  adminModulesCount: adminModules.length,
  moduleAnalysis
};

fs.writeFileSync('.agents/teamwork_preview_explorer_survey_3/backend_survey_raw.json', JSON.stringify(output, null, 2));
console.log('Survey complete. Found ' + Object.keys(rpcs).length + ' RPCs, ' + tables.size + ' Tables across ' + adminModules.length + ' admin files.');
